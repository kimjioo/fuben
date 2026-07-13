from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


DB_PATH = Path(os.getenv("DB_PATH", "/data/fuben.sqlite3"))
PORT = int(os.getenv("PORT", "8080"))
MAX_BODY_SIZE = 2 * 1024 * 1024
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,100}$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def secret_hash(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    return connection


def initialize_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                secret_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS records (
                team_id TEXT NOT NULL,
                id TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (team_id, id),
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS records_team_updated_idx ON records(team_id, updated_at DESC)"
        )


class ApiError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class BackupHandler(BaseHTTPRequestHandler):
    server_version = "FubenBackup/1.0"

    def do_GET(self) -> None:
        try:
            parts = self.path_parts()
            if parts == ["health"]:
                self.send_json(200, {"ok": True, "storage": "sqlite"})
                return
            if len(parts) == 3 and parts[0] == "teams" and parts[2] == "state":
                team_id = self.valid_id(parts[1], "团队 ID")
                secret = self.bearer_secret()
                self.require_team(team_id, secret)
                self.send_json(200, self.team_state(team_id))
                return
            raise ApiError(404, "接口不存在")
        except ApiError as error:
            self.send_json(error.status, {"error": error.message})
        except Exception:
            self.send_json(500, {"error": "服务器内部错误"})

    def do_POST(self) -> None:
        try:
            parts = self.path_parts()
            if parts == ["restore"]:
                body = self.read_json()
                recovery_code = str(body.get("recoveryCode", "")).strip()
                team_id, secret = self.parse_recovery_code(recovery_code)
                self.require_team(team_id, secret)
                self.send_json(200, self.team_state(team_id))
                return
            raise ApiError(404, "接口不存在")
        except ApiError as error:
            self.send_json(error.status, {"error": error.message})
        except Exception:
            self.send_json(500, {"error": "服务器内部错误"})

    def do_PUT(self) -> None:
        try:
            parts = self.path_parts()
            if len(parts) == 2 and parts[0] == "teams":
                self.upsert_team(self.valid_id(parts[1], "团队 ID"))
                return
            if len(parts) == 3 and parts[0] == "teams" and parts[2] == "state":
                self.merge_state(self.valid_id(parts[1], "团队 ID"))
                return
            if len(parts) == 4 and parts[0] == "teams" and parts[2] == "records":
                self.upsert_record(
                    self.valid_id(parts[1], "团队 ID"),
                    self.valid_id(parts[3], "记录 ID"),
                )
                return
            raise ApiError(404, "接口不存在")
        except ApiError as error:
            self.send_json(error.status, {"error": error.message})
        except Exception:
            self.send_json(500, {"error": "服务器内部错误"})

    def do_DELETE(self) -> None:
        try:
            parts = self.path_parts()
            if len(parts) == 4 and parts[0] == "teams" and parts[2] == "records":
                team_id = self.valid_id(parts[1], "团队 ID")
                record_id = self.valid_id(parts[3], "记录 ID")
                secret = self.bearer_secret()
                self.require_team(team_id, secret)
                with connect() as connection:
                    connection.execute(
                        "DELETE FROM records WHERE team_id = ? AND id = ?",
                        (team_id, record_id),
                    )
                self.send_json(200, {"ok": True})
                return
            raise ApiError(404, "接口不存在")
        except ApiError as error:
            self.send_json(error.status, {"error": error.message})
        except Exception:
            self.send_json(500, {"error": "服务器内部错误"})

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def upsert_team(self, team_id: str) -> None:
        body = self.read_json()
        name = str(body.get("name", "")).strip()
        secret = self.bearer_secret()
        if not name or len(name) > 60:
            raise ApiError(400, "团队名称无效")
        if len(secret) < 32:
            raise ApiError(400, "备份密钥无效")

        timestamp = now_iso()
        with connect() as connection:
            row = connection.execute(
                "SELECT secret_hash FROM teams WHERE id = ?",
                (team_id,),
            ).fetchone()
            if row:
                if not hmac.compare_digest(row["secret_hash"], secret_hash(secret)):
                    raise ApiError(403, "团队备份密钥错误")
                connection.execute(
                    "UPDATE teams SET name = ?, updated_at = ? WHERE id = ?",
                    (name, timestamp, team_id),
                )
            else:
                connection.execute(
                    "INSERT INTO teams(id, name, secret_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (team_id, name, secret_hash(secret), timestamp, timestamp),
                )
        self.send_json(200, {"ok": True, "teamId": team_id})

    def merge_state(self, team_id: str) -> None:
        secret = self.bearer_secret()
        self.require_team(team_id, secret)
        body = self.read_json()
        records = body.get("records", [])
        if not isinstance(records, list) or len(records) > 10000:
            raise ApiError(400, "记录列表无效")

        timestamp = now_iso()
        with connect() as connection:
            for record in records:
                record_id, payload = self.valid_record(team_id, record)
                connection.execute(
                    """
                    INSERT INTO records(team_id, id, payload, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(team_id, id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
                    """,
                    (team_id, record_id, payload, timestamp),
                )
            connection.execute(
                "UPDATE teams SET updated_at = ? WHERE id = ?",
                (timestamp, team_id),
            )
        self.send_json(200, {"ok": True, "saved": len(records)})

    def upsert_record(self, team_id: str, record_id: str) -> None:
        secret = self.bearer_secret()
        self.require_team(team_id, secret)
        record = self.read_json().get("record")
        parsed_id, payload = self.valid_record(team_id, record)
        if parsed_id != record_id:
            raise ApiError(400, "记录 ID 不一致")
        timestamp = now_iso()
        with connect() as connection:
            connection.execute(
                """
                INSERT INTO records(team_id, id, payload, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(team_id, id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
                """,
                (team_id, record_id, payload, timestamp),
            )
            connection.execute(
                "UPDATE teams SET updated_at = ? WHERE id = ?",
                (timestamp, team_id),
            )
        self.send_json(200, {"ok": True})

    def valid_record(self, team_id: str, record: Any) -> tuple[str, str]:
        if not isinstance(record, dict):
            raise ApiError(400, "记录内容无效")
        record_id = self.valid_id(str(record.get("id", "")), "记录 ID")
        if record.get("teamId") != team_id:
            raise ApiError(400, "记录不属于当前团队")
        payload = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
        if len(payload.encode("utf-8")) > 32 * 1024:
            raise ApiError(400, "单条记录过大")
        return record_id, payload

    def team_state(self, team_id: str) -> dict[str, Any]:
        with connect() as connection:
            team = connection.execute(
                "SELECT id, name, created_at, updated_at FROM teams WHERE id = ?",
                (team_id,),
            ).fetchone()
            if not team:
                raise ApiError(404, "团队不存在")
            rows = connection.execute(
                "SELECT payload FROM records WHERE team_id = ? ORDER BY updated_at DESC",
                (team_id,),
            ).fetchall()
        return {
            "team": {
                "id": team["id"],
                "name": team["name"],
                "createdAt": team["created_at"],
                "updatedAt": team["updated_at"],
            },
            "records": [json.loads(row["payload"]) for row in rows],
        }

    def require_team(self, team_id: str, secret: str) -> None:
        with connect() as connection:
            row = connection.execute(
                "SELECT secret_hash FROM teams WHERE id = ?",
                (team_id,),
            ).fetchone()
        if not row:
            raise ApiError(404, "团队备份不存在")
        if not hmac.compare_digest(row["secret_hash"], secret_hash(secret)):
            raise ApiError(403, "团队备份密钥错误")

    def bearer_secret(self) -> str:
        value = self.headers.get("Authorization", "")
        if not value.startswith("Bearer "):
            raise ApiError(401, "缺少团队备份密钥")
        secret = value[7:].strip()
        if not secret:
            raise ApiError(401, "缺少团队备份密钥")
        return secret

    def parse_recovery_code(self, value: str) -> tuple[str, str]:
        if "." not in value:
            raise ApiError(400, "备份码格式错误")
        team_id, secret = value.split(".", 1)
        return self.valid_id(team_id, "团队 ID"), secret.strip()

    def valid_id(self, value: str, label: str) -> str:
        value = unquote(value)
        if not ID_PATTERN.fullmatch(value):
            raise ApiError(400, f"{label}无效")
        return value

    def path_parts(self) -> list[str]:
        return [part for part in urlparse(self.path).path.split("/") if part]

    def read_json(self) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ApiError(400, "请求长度无效") from error
        if length <= 0 or length > MAX_BODY_SIZE:
            raise ApiError(413 if length > MAX_BODY_SIZE else 400, "请求内容无效")
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ApiError(400, "JSON 内容无效") from error
        if not isinstance(value, dict):
            raise ApiError(400, "请求内容无效")
        return value

    def send_json(self, status: int, data: dict[str, Any]) -> None:
        payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)


if __name__ == "__main__":
    initialize_database()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), BackupHandler)
    print(f"Fuben backup API listening on 0.0.0.0:{PORT}, database={DB_PATH}", flush=True)
    server.serve_forever()
