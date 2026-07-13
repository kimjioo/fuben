# 炸鸡团 · 黑本记录册

独立的副本掉落录入网页，字段结构兼容 `nonebot-plugin-kdocs-excel-summary` 使用的 Excel 记录表。

## 功能

- 支持创建和切换多个团队，每个团队的记录、统计与导出相互独立
- 首次访问先创建团名，旧版本记录会自动迁移到“炸鸡团”
- 每次打开页面会从 12 张本地剑网三壁纸中随机选择背景
- 自动带出不同副本的六级、小铁、玄晶和特殊掉落上限
- 录入黑本 ID、群友昵称、掉落数量、特殊掉落和备注
- 自动校验掉落数量，避免超过副本上限
- 浏览器本地保存、搜索、复用与删除记录
- 导出与现有统计表兼容的 UTF-8 CSV
- 响应式布局，支持电脑和手机

> 团队和记录保存在访问者浏览器的 `localStorage` 中。同一台设备可以管理多个团队，但数据不会自动同步到其他设备；需要汇总或迁移时请使用页面中的“导出 CSV”。

## Docker Compose 部署

服务器需要安装 Docker Engine 和 Docker Compose 插件。

```bash
git clone https://github.com/kimjioo/fuben.git
cd fuben
docker compose up -d --build
```

部署完成后访问：

```text
http://服务器IP:8080
```

查看运行状态和日志：

```bash
docker compose ps
docker compose logs -f fuben
```

更新到最新版本：

```bash
git pull
docker compose up -d --build
```

停止服务：

```bash
docker compose down
```

## 修改访问端口

默认使用宿主机 `8080` 端口。可以在启动前设置 `FUBEN_PORT`：

```bash
FUBEN_PORT=9000 docker compose up -d --build
```

或在项目目录创建 `.env`：

```env
FUBEN_PORT=9000
```

## 域名与 HTTPS

生产环境建议在容器前使用 Nginx、Caddy、Traefik 或服务器面板提供的反向代理，将域名转发到：

```text
http://127.0.0.1:8080
```

反向代理启用 HTTPS 后，可以把 Compose 端口改成仅监听本机：

```yaml
ports:
  - "127.0.0.1:8080:3000"
```

## 本地开发

需要 Node.js 22.13 或更高版本：

```bash
npm ci
npm run dev
```

生产构建：

```bash
npm run build
npm run start
```
