# RetailOS 经营工作台

面向连锁零售的经营管理演示系统：4 类角色登录后查看经营数据、管理库存与采购、处理退款，并可通过内置经营助手用自然语言查询数据、生成补货/采购/退款确认卡。

- 前端：Vue 3 + Vite + Element Plus + Pinia + ECharts
- 后端：NestJS + TypeORM + MySQL 8
- Agent：SSE 事件流（AG-UI 风格）+ 声明式 UI（A2UI 白名单）

## 目录结构

```text
retailos/
├─ src/                    前端源码（views / stores / components / features/agent）
├─ server/                 后端源码（NestJS 模块 + TypeORM 实体与迁移）
├─ scripts/                e2e、契约校验、架构守卫、密钥扫描、Chrome 探测
├─ deploy/nginx.conf       生产反向代理（含 SSE 关闭缓冲）
├─ screenshots/            e2e 产出的页面截图
├─ .github/workflows/ci.yml
├─ Dockerfile              前端镜像（构建后由 nginx 托管）
├─ server/Dockerfile       后端镜像
└─ docker-compose.yml
```

## 快速开始

前置：Node.js 22、MySQL 8、Chrome 或 Edge（仅 e2e 需要）。

### 1. 创建数据库

```bash
mysql -u root -p < server/scripts/init-mysql.sql
```

默认库名 `retailos`，账号 `retailos / retailos_dev`，仅用于本地开发。

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
cp .env.example .env.local
```

- `server/.env`：数据库、JWT、模型配置；默认 `LLM_PROVIDER=rule`，无需外部模型即可运行。
- `.env.local`：前端默认 `VITE_AGENT_TRANSPORT=mock`；连接本地后端时改为 `sse`（示例已写在文件内）。

`.env` 与 `.env.local` 均已被忽略，不会进入版本库。

### 3. 安装依赖

```bash
npm ci
npm ci --prefix server
```

### 4. 启动

```bash
npm run server    # 后端 http://127.0.0.1:3000
npm run dev       # 前端 http://127.0.0.1:5173，/api 代理到 3000
```

首次启动会自动执行迁移并写入演示数据。

### 5. 演示账号

| 角色 | 用户名 | 密码 | 数据范围 |
| --- | --- | --- | --- |
| 企业老板 | `owner` | `retailos123` | 全国 |
| 区域经理 | `regional` | `retailos123` | 华东区 |
| 店长 | `store` | `retailos123` | 静安店 S001 |
| 仓库管理员 | `warehouse` | `retailos123` | 华东中心仓 |

## 环境变量

### 前端

| 变量 | 说明 |
| --- | --- |
| `VITE_AGENT_TRANSPORT` | `mock`（前端模拟，无需后端）或 `sse`（走后端） |
| `VITE_AGENT_API_URL` | SSE 地址，留空/`/api/agent/stream` 走同源代理 |
| `VITE_API_BASE_URL` | 留空走同源代理；直连后端时填 `http://127.0.0.1:3000` |

### 后端

| 变量 | 说明 |
| --- | --- |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接 |
| `DB_SYNCHRONIZE` | 必须为 `false`，结构变更走 migration |
| `DB_MIGRATIONS_RUN` | 启动时自动迁移，默认 `true` |
| `JWT_SECRET` | 令牌密钥，生产必须替换为随机长字符串 |
| `LLM_PROVIDER` | `rule` / `stub` / OpenAI 兼容（`deepseek`、`modelscope` 等） |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` | 真实模型配置，仅非 rule 模式需要 |
| `HOST` / `PORT` | 监听地址与端口，默认 `127.0.0.1:3000` |

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 前端开发服务器（5173） |
| `npm run build` | 前端生产构建 |
| `npm run server` | 后端开发启动（ts-node） |
| `npm run db:reset` | 重置演示数据，保留 users / roles / migrations |
| `npm run e2e` | 主 e2e：登录、驾驶舱、Agent、审批、审计、移动端 |
| `npm run e2e:phase2` | 业务 e2e：商品、采购、库存、退款、分页搜索 |
| `npm run e2e:phase3` | 深化 e2e：导出、系统账号、Agent 确认卡 |
| `npm run verify:agent` | A2UI / AG-UI 契约校验（8 项） |
| `npm run check:arch` | 架构守卫：Agent 层禁止直连数据库 |
| `npm run check:secrets` | 扫描已跟踪文件中的密钥与私钥 |

e2e 说明：

- 每个 e2e 命令会自动重置演示数据，结束后恢复基线；
- 需要后端与前端已启动；各脚本默认端口为 4174 / 4175，建议统一指定：`$env:E2E_BASE_URL='http://127.0.0.1:4173'`；
- 指定端口：`$env:E2E_BASE_URL='http://127.0.0.1:4173'; npm run e2e`；
- 浏览器默认自动探测 Chrome/Edge，也可用 `CHROME_PATH` 指定。

## 经营助手

- **rule（默认）**：规则场景，覆盖销售/库存/商品/采购单查询、补货申请、采购单提交与审批、退款申请；写操作先出确认卡。
- **stub**：本地确定性模型，用于自动化测试。
- **真实模型**：任何 OpenAI 兼容接口；只输出 JSON Schema 组件描述，服务端白名单校验后渲染，禁止直出 HTML/CSS。

## 质量门禁

- 契约：`verify:agent` 8/8；
- 架构：`check:arch` 通过；
- 安全：`check:secrets` 无命中；
- 回归：主 e2e、phase2、phase3 全通过（rule 模式，无外部模型依赖）。

CI 见 `.github/workflows/ci.yml`：`build-and-smoke` 负责安装、密钥扫描、契约、架构、构建、健康检查与 smoke；`e2e` 负责 MySQL + 后端 + 前端 + 三套浏览器回归。

## 部署（可选）

```bash
docker compose up -d --build
```

- 前端由 nginx 托管并反向代理 `/api`，SSE 已关闭缓冲；
- 生产必须替换 `DB_PASSWORD` 与 `JWT_SECRET`，并在外层配置 HTTPS；
- 仅需容器时也可分别构建 `Dockerfile` 与 `server/Dockerfile`。

## 已知边界

- 单企业、以门店为数据范围，未实现多租户隔离；
- 业务测试以 e2e 为主，尚无服务层单元测试；
- 未内置集中日志、指标监控、接口限流与审计归档策略；
- 退款为演示流程，未接入真实支付渠道与对账系统。

生产化前请优先补齐安全基线、自动备份与恢复演练、可观测性与服务层测试。
