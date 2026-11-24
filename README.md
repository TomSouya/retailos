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
| `CORS_ORIGINS` | 允许的前端来源，逗号分隔；未配置时使用本地默认列表 |
| `TRUST_PROXY` | 位于 Nginx 等代理后设为 `1`，用于取真实客户端 IP |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | 全局限流窗口与上限，默认 60000ms / 1200 次 |
| `JWT_EXPIRES_IN` | 令牌有效期，默认 `8h` |
| `METRICS_TOKEN` | 设置后访问 `/api/metrics` 需携带 `Authorization: Bearer <token>` |

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
| `npm run e2e:concurrency` | 并发一致性：验收只入库一次、退款只成功一次 |
| `npm run test:server` | 服务层单元测试（退款计算、分页归一、采购状态机） |
| `npm run verify:agent` | A2UI / AG-UI 契约校验（8 项） |
| `npm run check:arch` | 架构守卫：Agent 层禁止直连数据库 |
| `npm run check:secrets` | 扫描已跟踪文件中的密钥与私钥 |

e2e 说明：

- 每个 e2e 命令会自动重置演示数据，结束后恢复基线；
- 需要后端与前端已启动；各脚本默认端口为 4174 / 4175，建议统一指定：`$env:E2E_BASE_URL='http://127.0.0.1:4173'`；
- 指定端口：`$env:E2E_BASE_URL='http://127.0.0.1:4173'; npm run e2e`；
- 浏览器默认自动探测 Chrome/Edge，也可用 `CHROME_PATH` 指定。

## 数据运维

| 命令 | 说明 |
| --- | --- |
| `npm run db:backup` | mysqldump 备份到 `backups/`，默认保留 14 天（读取 `DB_PASSWORD`） |
| `npm run db:restore -- -File backups/xxx.sql -Yes` | 从备份恢复，覆盖当前库 |
| `npm run db:archive-audit -- --days 90 --dry-run` | 导出 N 天前审计记录为 JSONL；去掉 `--dry-run` 后删除 |
| `npm run db:reconcile` | 只读对账：退款金额与状态、负库存、采购时间戳、库存流水 |

定时执行示例：

- Windows：`powershell -ExecutionPolicy Bypass -File scripts/register-maintenance-tasks.ps1`
  - 每日 02:00 备份、06:30 对账、每周日 03:30 审计归档；
  - 卸载：追加 `-Unregister`；
  - 日志：`backups/maintenance.log`。
- Linux cron：

```cron
0 2 * * *  cd /opt/retailos && npm run db:backup
30 6 * * * cd /opt/retailos && npm run db:reconcile
30 3 * * 0 cd /opt/retailos && npm run db:archive-audit -- --days 90
```

建议每次发布前跑一次 `db:reconcile` 与恢复演练，确认备份可用。

## 经营助手

- **rule（默认）**：规则场景，覆盖销售/库存/商品/采购单查询、补货申请、采购单提交与审批、退款申请；写操作先出确认卡。
- **stub**：本地确定性模型，用于自动化测试。
- **真实模型**：任何 OpenAI 兼容接口；只输出 JSON Schema 组件描述，服务端白名单校验后渲染，禁止直出 HTML/CSS。

## 可观测性

| 端点 | 用途 |
| --- | --- |
| `GET /api/health` | 完整健康检查（含数据库） |
| `GET /api/health/live` | 存活探针，不依赖数据库 |
| `GET /api/health/ready` | 就绪探针，数据库不可用时返回 503 |
| `GET /api/metrics` | Prometheus 文本指标（请求数、耗时、5xx、前端错误、DB 状态、运行时长） |

访问日志为单行 JSON（`event=http_request`，含 service、requestId、traceId、耗时、状态码、慢请求标记）；Nest 框架日志为 `event=nest_log`，前端上报为 `event=client_error`，均可直接由 Loki / CloudWatch / ELK 采集。

- `LOG_LEVEL`：`debug` / `info` / `warn` / `error`，默认 `info`；
- `LOG_FILE`：可选，追加写入文件；`LOG_FILE_MAX_MB`（默认 20）与 `LOG_FILE_KEEP`（默认 5）控制滚动；
- 前端错误：全局捕获 Vue、`window.onerror` 与 `unhandledrejection`，上报到 `POST /api/client-errors`，同一错误 60 秒去重、每次会话最多 20 条；指标为 `retailos_client_errors_total{source=...}`；
- 采集示例：`deploy/promtail.example.yml`（Docker stdout → Loki），也可用 Fluent Bit / Vector 采集同样的 JSON 行。

限流与指标为单实例内存实现，多实例需替换为 Redis 或 Prometheus 客户端。

### 监控与告警

- 抓取配置示例：`deploy/prometheus.example.yml`；
- 告警规则示例：`deploy/alerts.example.yml`（数据库不可用、5xx 比例、慢请求、5xx 突增、前端错误突增）；
- 探针：`/api/health/live`（存活）、`/api/health/ready`（就绪）；
- 若设置 `METRICS_TOKEN`，在 Prometheus 中用 `authorization.credentials_file` 提供令牌。
- 日志：设置 `LOG_FILE` 可直接采集文件，Docker 部署可直接复用 `deploy/promtail.example.yml`。

### 发布清单

1. `npm run test:server`；
2. `npm run check:secrets` 与依赖审计；
3. `npm run db:reconcile` 确认无对账异常；
4. `npm run db:backup` 留恢复点；
5. 确认 CI 全绿后打 tag：`git tag vX.Y.Z && git push origin vX.Y.Z`；
6. 部署后检查 `/api/health/ready` 与 `/api/metrics`。

`master` 已启用分支保护，要求 `build-and-smoke` 与 `e2e` 两个检查通过。

## 质量门禁

- 单元测试：退款计算、分页归一、采购状态机、前端错误上报校验；
- 契约：`verify:agent` 8/8；
- 架构：`check:arch` 通过；
- 安全：`check:secrets` 无命中，依赖审计无高危漏洞；
- 回归：主 e2e、phase2、phase3、并发一致性全部通过（rule 模式，无外部模型依赖）。

CI 见 `.github/workflows/ci.yml`：`build-and-smoke` 负责安装、密钥扫描、契约、架构、构建、健康检查与 smoke；`e2e` 负责 MySQL + 后端 + 前端 + 三套浏览器回归。

## 部署（可选）

### HTTPS 与安全

- 反向代理示例：`deploy/nginx-tls.example.conf`（HTTP→HTTPS、TLS 1.2/1.3、HSTS、SSE 关闭缓冲）；
- 证书可用 Let's Encrypt：

```bash
certbot certonly --nginx -d retail.example.com
```

- 后端环境变量：
  - `TRUST_PROXY=1`（取真实客户端 IP）；
  - `CORS_ORIGINS=https://retail.example.com`（多个用逗号分隔）；
  - 生产 `JWT_SECRET` 至少 32 位随机字符串。
- 示例中 HSTS 默认注释，确认证书与 HTTPS 正常后再开启。
- 验证：
  - `curl -I https://retail.example.com/api/health/ready`；
  - 检查证书链、HSTS、CORS 与 SSE 长连接。

### 容器

```bash
docker compose up -d --build
```

- 前端由 nginx 托管并反向代理 `/api`，SSE 已关闭缓冲；
- 生产必须替换 `DB_PASSWORD` 与 `JWT_SECRET`，并在外层配置 HTTPS；
- 仅需容器时也可分别构建 `Dockerfile` 与 `server/Dockerfile`。

## 已知边界

- 单企业、以门店为数据范围，未实现多租户隔离；
- 服务层单测覆盖退款、分页、采购状态机与前端错误校验，其余业务以 e2e 为主；
- 指标、限流与日志文件为单实例内存/本地实现，集中日志与告警需按 `deploy/` 示例接入 Loki / Prometheus；
- 退款为演示流程，未接入真实支付渠道与对账系统。

生产化前请优先补齐安全基线、自动备份与恢复演练、可观测性与服务层测试。
