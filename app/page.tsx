"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type DungeonRule = {
  name: string;
  six: number;
  iron: number;
  crystal: number;
  special: number;
};

type Team = {
  id: string;
  name: string;
  createdAt: string;
};

type RecordItem = {
  id: string;
  teamId: string;
  date: string;
  characterId: string;
  nickname: string;
  dungeon: string;
  six: number;
  iron: number;
  crystal: number;
  special: string;
  specialCount: number;
  note: string;
  createdAt: string;
};

type BackupStatus = "checking" | "local" | "syncing" | "synced" | "error";

type RemoteState = {
  team: Team & { updatedAt?: string };
  records: RecordItem[];
};

const rules: DungeonRule[] = [
  { name: "狼神殿", six: 6, iron: 0, crystal: 1, special: 2 },
  { name: "白帝江关", six: 14, iron: 0, crystal: 2, special: 8 },
  { name: "达摩洞", six: 12, iron: 0, crystal: 2, special: 4 },
  { name: "冷龙峰", six: 10, iron: 0, crystal: 2, special: 5 },
  { name: "范阳夜变", six: 10, iron: 0, crystal: 2, special: 5 },
  { name: "会战弓月城", six: 10, iron: 5, crystal: 0, special: 0 },
  { name: "辉天堑", six: 10, iron: 0, crystal: 1, special: 0 },
  { name: "九老洞", six: 12, iron: 0, crystal: 2, special: 3 },
  { name: "西津渡", six: 6, iron: 0, crystal: 1, special: 2 },
  { name: "武狱黑牢", six: 12, iron: 0, crystal: 2, special: 4 },
  { name: "河阳之战", six: 10, iron: 0, crystal: 2, special: 8 },
  { name: "敖龙岛", six: 12, iron: 0, crystal: 2, special: 6 },
];

const wallpapers = [
  "/wallpapers/jx3box-5651-01.webp",
  "/wallpapers/jx3box-5651-02.webp",
  "/wallpapers/jx3box-5651-03.webp",
  "/wallpapers/jx3box-5651-04.webp",
  "/wallpapers/jx3box-5651-05.webp",
  "/wallpapers/jx3box-5651-06.webp",
  "/wallpapers/jx3box-2249-01.webp",
  "/wallpapers/jx3box-2249-02.webp",
  "/wallpapers/jx3box-2249-03.webp",
  "/wallpapers/jx3box-2249-04.webp",
  "/wallpapers/jx3box-2249-05.webp",
  "/wallpapers/jx3box-2249-06.webp",
];

const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

const emptyForm = {
  date: today,
  characterId: "",
  nickname: "",
  dungeon: "狼神殿",
  six: 0,
  iron: 0,
  crystal: 0,
  special: "",
  specialCount: 0,
  note: "",
};

function Stepper({
  value,
  onChange,
  max,
  accent,
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  accent: string;
}) {
  return (
    <div className="stepper" style={{ "--accent": accent } as React.CSSProperties}>
      <button type="button" disabled={max === 0} onClick={() => onChange(Math.max(0, value - 1))} aria-label="减少 1">
        −
      </button>
      <input
        aria-label="掉落数量"
        type="number"
        min="0"
        max={max}
        disabled={max === 0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />
      <button type="button" disabled={max === 0} onClick={() => onChange(Math.min(max, value + 1))} aria-label="增加 1">
        +
      </button>
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState(emptyForm);
  const [wallpaper, setWallpaper] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [backupKeys, setBackupKeys] = useState<Record<string, string>>({});
  const [backupAvailable, setBackupAvailable] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus>("checking");
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const initializedBackups = useRef(new Set<string>());
  const backupKeysRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setWallpaper(wallpapers[Math.floor(Math.random() * wallpapers.length)]);
  }, []);

  useEffect(() => {
    const parse = <T,>(key: string, fallback: T): T => {
      try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    };

    let nextTeams = parse<Team[]>("blackbook-teams-v1", []);
    let nextRecords = parse<RecordItem[]>("blackbook-records-v2", []);
    const nextBackupKeys = parse<Record<string, string>>("blackbook-team-backup-keys-v1", {});
    let nextActiveTeamId = window.localStorage.getItem("blackbook-active-team-v1") ?? "";

    if (!nextTeams.length) {
      const legacyRecords = parse<Omit<RecordItem, "teamId">[]>("blackbook-records-v1", []);
      if (legacyRecords.length) {
        const legacyTeam: Team = {
          id: "team-zhajituan",
          name: "炸鸡团",
          createdAt: new Date().toISOString(),
        };
        nextTeams = [legacyTeam];
        nextActiveTeamId = legacyTeam.id;
        nextRecords = legacyRecords.map((record) => ({ ...record, teamId: legacyTeam.id }));
      }
    }

    if (nextTeams.length && !nextTeams.some((team) => team.id === nextActiveTeamId)) {
      nextActiveTeamId = nextTeams[0].id;
    }

    setTeams(nextTeams);
    setRecords(nextRecords);
    setBackupKeys(nextBackupKeys);
    backupKeysRef.current = nextBackupKeys;
    setActiveTeamId(nextActiveTeamId);
    setShowTeamModal(nextTeams.length === 0);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("blackbook-teams-v1", JSON.stringify(teams));
    window.localStorage.setItem("blackbook-records-v2", JSON.stringify(records));
    window.localStorage.setItem("blackbook-active-team-v1", activeTeamId);
    window.localStorage.setItem("blackbook-team-backup-keys-v1", JSON.stringify(backupKeys));
    backupKeysRef.current = backupKeys;
  }, [teams, records, activeTeamId, backupKeys, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("backup unavailable");
        }
        const data = await response.json();
        if (!cancelled && data?.ok && data?.storage === "sqlite") {
          setBackupAvailable(true);
          setBackupStatus("local");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackupAvailable(false);
          setBackupStatus("local");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeRule = rules.find((rule) => rule.name === form.dungeon) ?? rules[0];
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;
  const activeRecords = useMemo(
    () => records.filter((record) => record.teamId === activeTeamId),
    [records, activeTeamId],
  );
  const activeRecoveryCode = activeTeam && backupKeys[activeTeam.id]
    ? `${activeTeam.id}.${backupKeys[activeTeam.id]}`
    : "";
  const filteredRecords = useMemo(() => {
    const key = filter.trim().toLowerCase();
    const list = key
      ? activeRecords.filter((item) =>
          [item.nickname, item.characterId, item.dungeon, item.special].some((value) =>
            value.toLowerCase().includes(key),
          ),
        )
      : activeRecords;
    return showAll ? list : list.slice(0, 4);
  }, [activeRecords, filter, showAll]);

  const todayRecords = activeRecords.filter((record) => record.date === today);
  const todayDrops = todayRecords.reduce(
    (total, record) => total + record.six + record.iron + record.crystal + record.specialCount,
    0,
  );

  useEffect(() => {
    if (!hydrated || !backupAvailable || !activeTeam || initializedBackups.current.has(activeTeam.id)) {
      return;
    }
    initializedBackups.current.add(activeTeam.id);
    void syncTeamToVps(activeTeam, activeRecords).catch(() => {
      initializedBackups.current.delete(activeTeam.id);
    });
  }, [hydrated, backupAvailable, activeTeamId]);

  function newBackupSecret(): string {
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  }

  async function backupRequest(path: string, options: RequestInit = {}) {
    const response = await fetch(`/api${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "VPS 备份失败");
    return data;
  }

  async function ensureRemoteTeam(team: Team): Promise<string> {
    let secret = backupKeysRef.current[team.id];
    if (!secret) {
      secret = newBackupSecret();
      backupKeysRef.current = { ...backupKeysRef.current, [team.id]: secret };
      setBackupKeys((current) => ({ ...current, [team.id]: secret }));
    }
    await backupRequest(`/teams/${encodeURIComponent(team.id)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ name: team.name }),
    });
    return secret;
  }

  async function syncTeamToVps(team: Team, localRecords: RecordItem[]) {
    if (!backupAvailable) return;
    setBackupStatus("syncing");
    try {
      const secret = await ensureRemoteTeam(team);
      await backupRequest(`/teams/${encodeURIComponent(team.id)}/state`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ records: localRecords }),
      });
      const remote = await backupRequest(`/teams/${encodeURIComponent(team.id)}/state`, {
        headers: { Authorization: `Bearer ${secret}` },
      }) as RemoteState;
      const merged = new Map<string, RecordItem>();
      for (const record of remote.records) merged.set(record.id, record);
      for (const record of localRecords) merged.set(record.id, record);
      const mergedRecords = Array.from(merged.values()).sort((a, b) => b.id.localeCompare(a.id));
      setRecords((current) => [
        ...mergedRecords,
        ...current.filter((record) => record.teamId !== team.id),
      ]);
      setBackupStatus("synced");
    } catch (error) {
      setBackupStatus("error");
      setToast(error instanceof Error ? error.message : "VPS 备份失败，本地记录仍已保存");
      throw error;
    }
  }

  async function deleteRecordFromVps(team: Team, recordId: string) {
    if (!backupAvailable) return;
    setBackupStatus("syncing");
    try {
      const secret = await ensureRemoteTeam(team);
      await backupRequest(`/teams/${encodeURIComponent(team.id)}/records/${encodeURIComponent(recordId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${secret}` },
      });
      setBackupStatus("synced");
    } catch (error) {
      setBackupStatus("error");
      setToast(error instanceof Error ? error.message : "VPS 删除同步失败");
    }
  }

  async function restoreFromVps(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = recoveryCode.trim();
    if (!code || !backupAvailable) return;
    setRestoring(true);
    try {
      const remote = await backupRequest("/restore", {
        method: "POST",
        body: JSON.stringify({ recoveryCode: code }),
      }) as RemoteState;
      const separator = code.indexOf(".");
      const secret = code.slice(separator + 1);
      setTeams((current) => [remote.team, ...current.filter((team) => team.id !== remote.team.id)]);
      setRecords((current) => [
        ...remote.records,
        ...current.filter((record) => record.teamId !== remote.team.id),
      ]);
      backupKeysRef.current = { ...backupKeysRef.current, [remote.team.id]: secret };
      setBackupKeys((current) => ({ ...current, [remote.team.id]: secret }));
      setActiveTeamId(remote.team.id);
      initializedBackups.current.add(remote.team.id);
      setRecoveryCode("");
      setShowBackupModal(false);
      setShowTeamModal(false);
      setBackupStatus("synced");
      setToast(`已从 VPS 恢复“${remote.team.name}”及 ${remote.records.length} 条记录`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "恢复失败，请检查备份码");
    } finally {
      setRestoring(false);
    }
  }

  async function copyRecoveryCode() {
    if (!activeRecoveryCode) return;
    try {
      await navigator.clipboard.writeText(activeRecoveryCode);
      setToast("团队备份码已复制，请妥善保管");
    } catch {
      setToast("浏览器无法自动复制，请手动选择备份码");
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!activeTeam) {
      setShowTeamModal(true);
      setToast("请先创建或选择一个团队");
      return;
    }
    if (!form.characterId.trim() || !form.nickname.trim()) {
      setToast("请先填写黑本 ID 和群友昵称");
      return;
    }
    if (
      form.six > activeRule.six ||
      form.iron > activeRule.iron ||
      form.crystal > activeRule.crystal ||
      form.specialCount > activeRule.special
    ) {
      setToast("有掉落数量超过该副本的可掉落上限");
      return;
    }

    const now = new Date();
    const next: RecordItem = {
      ...form,
      teamId: activeTeam.id,
      characterId: form.characterId.trim(),
      nickname: form.nickname.trim(),
      special: form.special.trim(),
      id: `${Date.now()}`,
      createdAt: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };
    setRecords((current) => [next, ...current]);
    setForm((current) => ({ ...emptyForm, date: current.date, characterId: current.characterId, nickname: current.nickname, dungeon: current.dungeon }));
    setToast(backupAvailable ? "记录已保存，正在备份到 VPS" : "记录已保存到本机");
    void syncTeamToVps(activeTeam, [next, ...activeRecords]);
  }

  function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = teamName.trim();
    if (!name) return;
    if (teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
      setToast("已经存在同名团队");
      return;
    }

    const team: Team = {
      id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      createdAt: new Date().toISOString(),
    };
    setTeams((current) => [...current, team]);
    setActiveTeamId(team.id);
    setFilter("");
    setShowAll(false);
    setTeamName("");
    setShowTeamModal(false);
    setToast(`已创建团队“${name}”`);
    if (backupAvailable) void syncTeamToVps(team, []);
  }

  function switchTeam(teamId: string) {
    setActiveTeamId(teamId);
    setFilter("");
    setShowAll(false);
    setToast(`已切换到“${teams.find((team) => team.id === teamId)?.name ?? "团队"}”`);
  }

  function duplicate(record: RecordItem) {
    setForm({
      date: today,
      characterId: record.characterId,
      nickname: record.nickname,
      dungeon: record.dungeon,
      six: 0,
      iron: 0,
      crystal: 0,
      special: "",
      specialCount: 0,
      note: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    setToast("已带入上一条成员信息");
  }

  function remove(id: string) {
    setRecords((current) => current.filter((item) => item.id !== id));
    setToast("记录已删除");
    if (activeTeam) void deleteRecordFromVps(activeTeam, id);
  }

  function exportCsv() {
    const header = [
      "日期",
      "黑本id",
      "黑本群友昵称",
      "副本名称",
      "计数列（隐藏）",
      "可掉六级boss数",
      "可掉小铁boss数",
      "可掉玄晶boss数",
      "可掉其它特殊数",
      "六级",
      "特殊",
      "特殊计数列",
      "铁（当期十人限定）",
      "备注",
    ];
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = activeRecords.map((record) => {
      const rule = rules.find((item) => item.name === record.dungeon) ?? rules[0];
      const specials = [record.crystal ? "玄晶" : "", record.special].filter(Boolean).join(" / ");
      return [
        record.date,
        record.characterId,
        record.nickname,
        record.dungeon,
        1,
        rule.six / 2,
        rule.iron,
        rule.crystal,
        rule.special,
        record.six,
        specials,
        record.crystal + record.specialCount,
        record.iron,
        record.note,
      ].map(escape).join(",");
    });
    const blob = new Blob(["\uFEFF", header.map(escape).join(","), "\n", rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const safeTeamName = (activeTeam?.name ?? "团队").replace(/[\\/:*?"<>|]/g, "-");
    anchor.download = `${safeTeamName}-黑本记录-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast(`已导出 ${activeRecords.length} 条记录`);
  }

  const backupLabel = !backupAvailable
    ? "本机记录模式"
    : backupStatus === "syncing"
      ? "正在备份到 VPS"
      : backupStatus === "error"
        ? "VPS 备份异常"
        : backupStatus === "synced"
          ? "VPS 已安全备份"
          : "VPS 备份已连接";
  const backupDetail = !backupAvailable
    ? "Docker 部署后自动启用云备份"
    : activeRecoveryCode
      ? "点击查看团队备份码"
      : "正在为团队建立备份";

  return (
    <main className="shell">
      <div
        className={`wallpaper-layer ${wallpaper ? "is-ready" : ""}`}
        style={wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined}
        aria-hidden="true"
      />
      <div className="wallpaper-shade" aria-hidden="true" />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">{activeTeam?.name.slice(0, 1) ?? "团"}</div>
          <div>
            <strong>{activeTeam?.name ?? "副本团队"}</strong>
            <span>黑本记录册</span>
          </div>
        </div>
        <div className="team-picker">
          <span>当前团队</span>
          <div>
            <select
              aria-label="切换团队"
              value={activeTeamId}
              onChange={(event) => switchTeam(event.target.value)}
              disabled={!teams.length}
            >
              {!teams.length && <option value="">尚未创建团队</option>}
              {teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
            </select>
            <button type="button" onClick={() => setShowTeamModal(true)} aria-label="创建新团队" title="创建新团队">＋</button>
          </div>
        </div>
        <nav aria-label="主导航">
          <a className="active" href="#entry"><span>✦</span> 录入台</a>
          <a href="#recent"><span>◷</span> 最近记录</a>
          <a href="#rules"><span>◇</span> 掉落规则</a>
        </nav>
        <button
          className={`sync-card backup-${backupStatus}`}
          type="button"
          onClick={() => {
            setShowTeamModal(false);
            setShowBackupModal(true);
          }}
        >
          <span className="status-dot" />
          <div><strong>{backupLabel}</strong><small>{backupDetail}</small></div>
        </button>
        <div className="sidebar-footer">数据结构兼容现有 Excel 统计</div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeTeam?.name ?? "CREATE YOUR TEAM"} · DUNGEON LOG</p>
            <h1>副本记录录入</h1>
            <p>{activeTeam ? `正在记录“${activeTeam.name}”的每一次黑本掉落。` : "创建团名后即可开始记录。"}</p>
          </div>
          <div className="today-card">
            <div><span>今日记录</span><strong>{todayRecords.length}</strong></div>
            <i />
            <div><span>今日掉落</span><strong>{todayDrops}</strong></div>
          </div>
        </header>

        <form id="entry" className="entry-card" onSubmit={submit}>
          <div className="section-head">
            <div><span className="section-index">01</span><div><h2>本次副本</h2><p>先确认成员和副本，掉落上限会自动带入</p></div></div>
            <span className="required-note"><b>*</b> 为必填项</span>
          </div>

          <div className="form-grid basics">
            <label>
              <span>日期 <b>*</b></span>
              <input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required />
            </label>
            <label>
              <span>黑本 ID <b>*</b></span>
              <input value={form.characterId} onChange={(event) => update("characterId", event.target.value)} placeholder="游戏角色名" required />
            </label>
            <label>
              <span>群友昵称 <b>*</b></span>
              <input value={form.nickname} onChange={(event) => update("nickname", event.target.value)} placeholder="群内常用昵称" required />
            </label>
            <label className="dungeon-select">
              <span>副本名称 <b>*</b></span>
              <select value={form.dungeon} onChange={(event) => update("dungeon", event.target.value)}>
                {rules.map((rule) => <option key={rule.name}>{rule.name}</option>)}
              </select>
            </label>
          </div>

          <div id="rules" className="rule-strip">
            <div className="rule-title"><span>自动</span><div><strong>{activeRule.name}</strong><small>本次可掉落上限</small></div></div>
            <div className="rule-value orange"><span>六级</span><strong>{activeRule.six}</strong></div>
            <div className="rule-value blue"><span>小铁</span><strong>{activeRule.iron}</strong></div>
            <div className="rule-value purple"><span>玄晶</span><strong>{activeRule.crystal}</strong></div>
            <div className="rule-value gold"><span>其他特殊</span><strong>{activeRule.special}</strong></div>
          </div>

          <div className="divider" />

          <div className="section-head compact">
            <div><span className="section-index">02</span><div><h2>实际掉落</h2><p>没有掉落的项目保持为 0 即可</p></div></div>
            <span className="hint">数量会参与掉率统计</span>
          </div>

          <div className="drop-grid">
            <div className="drop-card orange">
              <div className="drop-icon">六</div><div className="drop-copy"><strong>六级五行石</strong><span>上限 {activeRule.six}</span></div>
              <Stepper value={form.six} onChange={(value) => update("six", value)} max={activeRule.six} accent="#ff9c4b" />
            </div>
            <div className={`drop-card blue ${activeRule.iron === 0 ? "muted" : ""}`}>
              <div className="drop-icon">铁</div><div className="drop-copy"><strong>小铁</strong><span>{activeRule.iron ? `上限 ${activeRule.iron}` : "本副本不统计"}</span></div>
              <Stepper value={form.iron} onChange={(value) => update("iron", value)} max={activeRule.iron} accent="#74c9ff" />
            </div>
            <div className={`drop-card purple ${activeRule.crystal === 0 ? "muted" : ""}`}>
              <div className="drop-icon">晶</div><div className="drop-copy"><strong>玄晶</strong><span>{activeRule.crystal ? `上限 ${activeRule.crystal}` : "本副本不统计"}</span></div>
              <Stepper value={form.crystal} onChange={(value) => update("crystal", value)} max={activeRule.crystal} accent="#b49cff" />
            </div>
          </div>

          <div className="special-row">
            <label className="special-input">
              <span>其他特殊掉落</span>
              <input value={form.special} onChange={(event) => update("special", event.target.value)} placeholder="例如：麒麟、挂件、外观…" />
              <small>多个掉落可用“ / ”分隔</small>
            </label>
            <label className="special-count">
              <span>特殊数量</span>
              <input type="number" min="0" max={activeRule.special || 99} value={form.specialCount} onChange={(event) => update("specialCount", Number(event.target.value) || 0)} />
            </label>
          </div>

          <label className="note-field">
            <span>备注</span>
            <textarea value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="双闪、首通、补录等需要说明的情况…" maxLength={120} />
            <small>{form.note.length} / 120</small>
          </label>

          <div className="form-actions">
            <button className="secondary" type="button" onClick={() => setForm(emptyForm)}>清空本次</button>
            <div className="save-note"><span>✓</span><div><strong>{backupAvailable ? "本机与 VPS 双重保存" : "自动保存在当前浏览器"}</strong><small>{backupAvailable ? "断网时本地记录仍然保留" : "Docker 部署后可启用 VPS 备份"}</small></div></div>
            <button className="primary" type="submit"><span>＋</span> 加入副本记录</button>
          </div>
        </form>

        <section id="recent" className="recent-section">
          <div className="recent-head">
            <div><p className="eyebrow">RECENT LOGS</p><h2>最近记录</h2></div>
            <div className="table-actions">
              <label className="search-box"><span>⌕</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索昵称、副本…" /></label>
              <button type="button" onClick={exportCsv}>⇩ 导出 CSV</button>
            </div>
          </div>

          <div className="record-list">
            {filteredRecords.map((record) => (
              <article className="record-row" key={record.id}>
                <div className="avatar">{record.nickname.slice(0, 1)}</div>
                <div className="record-person"><strong>{record.nickname}</strong><span>{record.characterId}</span></div>
                <div className="record-dungeon"><span>副本</span><strong>{record.dungeon}</strong></div>
                <div className="loot-pills">
                  {record.six > 0 && <span className="loot orange">六级 × {record.six}</span>}
                  {record.iron > 0 && <span className="loot blue">小铁 × {record.iron}</span>}
                  {record.crystal > 0 && <span className="loot purple">玄晶 × {record.crystal}</span>}
                  {record.special && <span className="loot gold">{record.special} × {record.specialCount || 1}</span>}
                  {!record.six && !record.iron && !record.crystal && !record.special && <span className="empty-loot">无掉落</span>}
                </div>
                <div className="record-time"><strong>{record.createdAt}</strong><span>{record.date}</span></div>
                <div className="row-actions">
                  <button type="button" onClick={() => duplicate(record)} title="复用成员信息">↗</button>
                  <button className="delete" type="button" onClick={() => remove(record.id)} title="删除记录">×</button>
                </div>
              </article>
            ))}
            {!filteredRecords.length && <div className="empty-state">没有找到匹配的记录</div>}
          </div>
          {activeRecords.length > 4 && !filter && (
            <button className="show-more" type="button" onClick={() => setShowAll((value) => !value)}>
              {showAll ? "收起记录" : `查看全部 ${activeRecords.length} 条记录`}
            </button>
          )}
        </section>

        <footer>
          <span>{activeTeam?.name ?? "团队"}黑本记录册</span>
          <p>多团队独立记录 · 字段结构兼容现有统计插件</p>
          <p className="wallpaper-credit">
            壁纸来源：
            <a href="https://www.jx3box.com/community/5651?page=1&onlyAuthor=false" target="_blank" rel="noreferrer">JX3BOX 第一期</a>
            <i>·</i>
            <a href="https://www.jx3box.com/community/2249?page=1&onlyAuthor=false" target="_blank" rel="noreferrer">JX3BOX 合集</a>
          </p>
        </footer>
      </section>

      {hydrated && showTeamModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="team-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
            {teams.length > 0 && (
              <button className="modal-close" type="button" onClick={() => setShowTeamModal(false)} aria-label="关闭">×</button>
            )}
            <div className="modal-mark">团</div>
            <p className="eyebrow">CREATE A TEAM</p>
            <h2 id="team-modal-title">创建你的团队</h2>
            <p>输入团名后，这个团队会拥有独立的副本记录、今日统计和 CSV 文件。</p>
            <form onSubmit={createTeam}>
              <label>
                <span>团队名称 <b>*</b></span>
                <input
                  autoFocus
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="例如：炸鸡团、周末十人团"
                  maxLength={30}
                  required
                />
              </label>
              <button className="primary" type="submit">创建并开始记录</button>
            </form>
            {backupAvailable && (
              <button
                className="restore-link"
                type="button"
                onClick={() => {
                  setShowTeamModal(false);
                  setShowBackupModal(true);
                }}
              >
                已有团队备份码？从 VPS 恢复
              </button>
            )}
            <small>{backupAvailable ? "创建后会同时保存到浏览器和 VPS。" : "记录保存在当前浏览器，不同团队的数据不会混在一起。"}</small>
          </section>
        </div>
      )}

      {hydrated && showBackupModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="team-modal backup-modal" role="dialog" aria-modal="true" aria-labelledby="backup-modal-title">
            <button
              className="modal-close"
              type="button"
              onClick={() => {
                setShowBackupModal(false);
                if (!teams.length) setShowTeamModal(true);
              }}
              aria-label="关闭"
            >×</button>
            <div className="modal-mark">备</div>
            <p className="eyebrow">VPS BACKUP</p>
            <h2 id="backup-modal-title">团队云端备份</h2>
            <p>{backupAvailable ? "记录会同时写入浏览器与 VPS 的 SQLite 数据库。" : "当前环境没有连接到 VPS 备份服务，记录仍安全保存在本机。"}</p>

            {backupAvailable && activeTeam && activeRecoveryCode && (
              <div className="recovery-box">
                <span>{activeTeam.name} · 团队备份码</span>
                <code>{activeRecoveryCode}</code>
                <button type="button" onClick={copyRecoveryCode}>复制备份码</button>
                <small>本地资料丢失后，需要此备份码从 VPS 恢复。请存放在密码管理器中。</small>
              </div>
            )}

            {backupAvailable && activeTeam && !activeRecoveryCode && (
              <button className="manual-sync" type="button" onClick={() => void syncTeamToVps(activeTeam, activeRecords)}>
                立即建立 VPS 备份
              </button>
            )}

            {backupAvailable && (
              <form className="restore-form" onSubmit={restoreFromVps}>
                <label>
                  <span>使用备份码恢复团队</span>
                  <textarea
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value)}
                    placeholder="粘贴 team-… 开头的完整备份码"
                    rows={3}
                    required
                  />
                </label>
                <button className="primary" type="submit" disabled={restoring}>
                  {restoring ? "正在恢复…" : "从 VPS 恢复团队资料"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
