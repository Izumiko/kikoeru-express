# Kikoeru-Express 渐进式重构评审与实施方案

## 当前执行状态

更新时间：2026-06-11。

这份文档最初用于评审旧代码的渐进式重构路径。当前仓库已经执行了多轮破坏性重构，下面的历史分析仍可作为背景，但不再代表当前代码状态。

已经完成：

- 运行时和工具链已迁到现代 Node 目标，当前 `engines.node` 为 `>=22.0.0`，CI/发布链路面向 Node 24。
- 旧根目录兼容入口已经移除，运行入口统一为 `src/cli/server.js`、`src/cli/scanner.js`、`src/cli/updater.js`。
- `pkg` 打包链路已经移除，后端发布改为 esbuild 生成 `build/server.js`、`build/scanner.js`、`build/updater.js`，再用 Node 直接运行。
- 配置路径解析已经集中到 `src/config`，bundle 运行数据目录可通过 `KIKOERU_RUNTIME_DIR` 覆盖。
- 路由、媒体、metadata、review、auth、config、version、socket、scanner、scraper 模块已经迁入 `src/modules`。
- Socket.IO 已升级到 4.x，并保留现有事件协议；HTTP JWT 和 Socket.IO 认证复用同一 auth service。
- Express 已升级到 5.x。当前决策是继续使用 Express，暂不切换 Elysia/Fastify。
- 数据库已从 Knex/sqlite3/自定义迁移迁到 Drizzle ORM + libSQL client。
- 旧数据库升级路径、旧 Knex 迁移、spinup 测试和 `spikes` 已删除。这是有意的破坏性变更，不再兼容旧库升级。
- `src/database` 已重组为 `client.js`、`schema/`、`repositories/`、`init.js`。
- 契约测试、媒体测试、扫描器测试、Socket 测试和数据库 repository parity 测试已覆盖当前主要行为。

当前保留/待完善：

- 源码仍是 CommonJS JavaScript。TypeScript 迁移作为下一阶段处理。
- 发布链路已改为 esbuild bundle，但真实 CI、Docker multiarch 和 release archive 仍需在发布前验证。
- 数据库仓储中仍有一部分过渡期 raw SQL，后续应逐步用 Drizzle 查询构造器替换；`staticMetadata` 视图定义和 SQLite 特有函数可以保留 SQL。
- 配置兼容迁移逻辑仍保留，是否进一步做破坏性清理需要单独决策。
- 前端尚未重构，需要在前端升级时真实验证 Socket.IO 4 客户端兼容性。

## 结论

原方案的方向有价值，但不适合作为可直接执行的重构计划。

主要问题不是 TypeScript、更新运行时、强化数据库层这些目标本身，而是原方案把 Web 框架、ORM、SQLite 驱动、Socket 协议、项目目录、部署方式同时替换，接近一次全量重写。当前项目还承担前端静态资源服务、SPA fallback、HTTP/HTTPS 双服务、Socket.IO 管理后台、子进程扫描器、`pkg`/Docker 打包、历史数据库迁移和配置文件迁移。直接按原方案执行，会把兼容性风险集中到一次切换里，难以回滚。

推荐采用渐进式重构：

1. 先冻结现有行为契约和数据库契约。
2. 再在现有 Express/Knex 边界内引入 TypeScript、测试、模块化和类型约束。
3. 等业务模块稳定后，再评估是否替换 Web 框架和 ORM。
4. Socket.IO、媒体流、配置迁移和桌面/容器打包必须作为一等兼容目标，而不是后续补充项。

## 当前系统约束

以下判断基于当前仓库代码，而不是抽象的后端服务假设。

### 运行入口

- `app.js` 同时负责 Express 应用、静态前端 `dist`、`connect-history-api-fallback`、API 挂载、HTTP/HTTPS server、gzip 和错误处理。
- `api.js` 在 `/api` 下挂载认证中间件和路由，当前公开 API 不是 `/api/v1`。
- `socket.js` 直接绑定 HTTP/HTTPS server，并通过 Socket.IO 事件控制扫描和更新子进程。

### API 兼容性

现有前端和外部调用依赖历史路径，例如：

- `/api/auth/me`
- `/api/config/admin`
- `/api/config/shared`
- `/api/media/stream/:id/:index`
- `/api/media/download/:id/:index`
- `/api/media/check-lrc/:id/:index`
- `/api/media/find-all-lrc/:id/:index`
- `/api/work/:id`
- `/api/tracks/:id`
- `/api/works`
- `/api/search/:keyword?`
- `/api/review`
- `/api/circles`, `/api/tags`, `/api/vas`

因此，新版本可以增加 `/api/v1`，但不能直接替换现有 `/api`。

### 数据库约束

- 当前使用 SQLite + Knex + 自定义迁移。
- 数据库文件默认位于 `config.databaseFolderDir/db.sqlite3`。
- 存在历史迁移修复逻辑、`dbVersion` 校验和旧版本 spinup 测试。
- 查询大量依赖 `staticMetadata` 视图、SQLite JSON 函数、`strftime`、`INSERT OR IGNORE`、事务和手写 SQL。
- 迁移必须兼容已有用户数据库，不能只面向新库。

### 配置和部署约束

- `config.js` 有模块加载副作用：不存在配置文件时会创建 `config/config.json`。
- `process.pkg`、`IS_DOCKER`、相对路径、默认 covers/sqlite/VoiceWork 路径都影响运行位置。
- `Dockerfile` 当前构建前端并持久化 `sqlite`、`config`、`covers`。
- `package.json` 仍有 `pkg` 和 Tauri 资源构建脚本。

### 扫描器和实时通信约束

- 管理后台通过 Socket.IO 事件调用 `PERFORM_SCAN`、`PERFORM_UPDATE`、`KILL_SCAN_PROCESS`。
- 扫描器通过 `process.send()` 回传 `SCAN_TASKS`、`SCAN_RESULTS`、`SCAN_MAIN_LOGS`、`SCAN_FAILED_TASKS`、`SCAN_FINISHED`、`SCAN_ERROR` 等事件。
- 如果把 Socket.IO 换成裸 `ws`，前端协议也必须同步重写。这个改动不应和后端模块重构混在同一阶段。

### 媒体服务约束

- 媒体流接口有特殊行为：文本字幕编码检测、`.flac` content-type、反代 offload 302、Windows 路径转 URL、`sendFile`/`download`。
- 字幕查找逻辑支持 `.lrc`、`.txt`、`.vtt`，并对 txt 中的 WebVTT 内容做启发式判断。

## 原方案需要修正的点

1. **不建议第一阶段直接从 Express 切到 Elysia。**
   Elysia 可以作为候选，但在 Node.js 部署下需要适配器，并且必须验证静态资源、SPA fallback、媒体下载、HTTPS、Socket.IO 和现有中间件模型。框架替换应放在业务模块 TypeScript 化之后。

2. **不建议同时替换 Knex、sqlite3 和迁移系统。**
   Drizzle + better-sqlite3 可以作为目标之一，但必须先建立 schema parity、查询结果 parity 和旧库迁移测试。`better-sqlite3` 是同步 API，是否提升性能要通过本项目负载验证，不能预设 2-3 倍收益。

3. **不应把 Socket.IO 直接替换为 `ws`。**
   Socket.IO 不是裸 WebSocket 协议，替换会影响前端事件协议、认证、重连和管理后台。第一轮应保留 Socket.IO，最多做版本升级和事件契约文档化。

4. **不能直接引入 `/api/v1` 并迁移所有路由。**
   `/api` 路径必须保持兼容。可以在后续添加 `/api/v1` 别名或新接口，但不能让现有前端失效。

5. **不建议创建平行的 `kikoeru-modern/` 项目。**
   当前仓库根目录承载 Docker、pkg、Tauri 资源、静态前端、配置路径和测试。平行项目会制造两套入口和打包逻辑。除非验证原地迁移不可行，否则应在当前仓库内渐进迁移。

6. **包版本清单不应提前硬编码。**
   依赖版本必须以当时的 Node LTS、原生模块支持、前端兼容和 CI 验证为准。先定义技术边界和验收标准，再锁版本。

7. **缺少安全升级路径。**
   当前用户密码使用 MD5。重构时应设计兼容迁移：登录时支持旧 MD5 校验，成功后升级为 bcrypt/argon2 哈希。

8. **缺少可回滚策略。**
   数据库、配置文件和封面目录都需要备份策略，迁移必须可重复、可跳过、可恢复。

## 修订后的目标

### 必须达成

- 保持现有 `/api` 行为兼容。
- 保持现有 SQLite 数据库可升级、可读取、可回滚。
- 保持前端 `dist` 静态服务和 SPA fallback 行为。
- 保持 HTTP/HTTPS、Docker、Windows 路径、`process.pkg` 路径处理。
- 保持扫描器管理后台事件协议，至少第一轮不破坏 Socket.IO。
- 引入 TypeScript 类型检查和模块边界，降低维护成本。
- 为核心查询、媒体接口、配置迁移、扫描器事件建立测试。

### 可以延后

- 切换到 Elysia 或其他新 Web 框架。
- 切换到 Drizzle ORM。
- 替换 Socket.IO 为裸 WebSocket。
- 重写 Docker 前端构建流程。
- 新增 `/api/v1` 作为主接口。

### 不作为本轮目标

- 拆成微服务。
- 改写前端应用。
- 更换 SQLite 为其他数据库。
- 改变现有文件夹命名规则和 RJ 扫描规则。

## 推荐技术路线

| 层 | 当前 | 推荐阶段性目标 | 说明 |
| --- | --- | --- | --- |
| 运行时 | Node 12-14 | Node 24 LTS，必要时 CI 保留 Node 22 | Node 20 已不适合作为新目标；原生依赖需单独验证 |
| 语言 | CommonJS JavaScript | TypeScript，先 `allowJs/checkJs`，再逐步 `.ts` | 初期不强行切 ESM，降低迁移风险 |
| Web 框架 | Express 4 | 第一轮保留 Express，后续评估 Elysia/Fastify/继续 Express | 框架替换放到模块稳定之后 |
| 数据访问 | Knex + sqlite3 | 先建立 Repository 层；再评估 Drizzle + better-sqlite3 | 避免 ORM 和业务迁移同时发生 |
| 实时通信 | Socket.IO 2 | 先保留协议；后续协调前端升级到 Socket.IO 4 | 不直接替换为 `ws` |
| 验证 | express-validator | 新模块可用 Zod，旧路由逐步迁移 | 先不一次性替换所有验证 |
| 日志 | console | 结构化 logger 包装层 | 先抽象接口，后定实现 |
| 测试 | Mocha + 少量迁移测试 | 先补契约测试；测试框架可延后统一 | 不把测试框架迁移作为功能阻塞点 |
| 密码 | MD5 | 兼容校验后渐进升级 bcrypt/argon2 | 避免一次性锁死旧用户 |

## 目标目录结构

保留仓库根目录和现有入口的兼容性，逐步新增 `src/`。旧文件迁移完成前，可以由旧入口调用新模块。

```text
kikoeru-express/
├── src/
│   ├── app.ts                    # Express 应用组装，迁移完成后替代 app.js 中大部分逻辑
│   ├── server.ts                 # HTTP/HTTPS 启动与 Socket 初始化
│   ├── config/
│   │   ├── defaults.ts
│   │   ├── loader.ts             # 兼容 process.pkg、IS_DOCKER、FREEZE_CONFIG_FILE
│   │   ├── schema.ts             # 配置校验
│   │   └── index.ts
│   ├── database/
│   │   ├── client.ts             # 当前可先包装 Knex
│   │   ├── repositories/
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── parity-tests/
│   ├── modules/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── media/
│   │   ├── metadata/
│   │   ├── review/
│   │   ├── scanner/
│   │   └── socket/
│   ├── middleware/
│   ├── types/
│   └── utils/
├── auth/                         # 迁移期间保留
├── database/                     # 迁移期间保留
├── filesystem/                   # 迁移期间保留
├── routes/                       # 迁移期间保留
├── scraper/                      # 迁移期间保留
├── static/
├── test/
├── dist/
├── app.js                        # 迁移期兼容入口，最终变薄
├── socket.js                     # 迁移期兼容入口，最终变薄
├── package.json
└── Dockerfile
```

## 详细实施方案

### 阶段 0：基线冻结和风险清单

目标：在任何代码迁移前，先知道什么行为不能破坏。

任务：

- 记录当前 API 清单、请求参数、响应结构和状态码。
- 为核心 API 建立 contract tests：认证、配置、作品列表、搜索、详情、曲目树、媒体流、下载、字幕检测、评价。
- 建立数据库兼容测试：新建库、从旧版本迁移、`staticMetadata` 视图输出、`t_review` 行为、`t_va` UUID 行为。
- 建立 Socket.IO 事件清单和最小集成测试：启动扫描、扫描状态回放、结束、失败、终止。
- 准备小型 fixtures：测试 SQLite、测试 VoiceWork 目录、字幕文件、封面 fallback、DLsite/HVDB HTML/API mock。
- 记录 Docker、Windows、本地开发、`process.pkg` 路径行为。

验收：

- 当前主分支在基线测试下通过。
- 所有后续阶段都可以用同一套测试判断是否破坏兼容性。

### 阶段 1：运行时和工具链升级

目标：把项目带到现代 Node/TypeScript 工具链，但不改变业务行为。

任务：

- 将目标运行时改为 Node 24 LTS；如果原生依赖或打包工具阻塞，CI 临时保留 Node 22 验证。
- 新增 `tsconfig.json`，初期使用 `allowJs: true`、`checkJs: false` 或局部 `checkJs`。
- 新增 `tsx`/`ts-node` 开发脚本，保留 `node app.js` 生产入口。
- 新增 `npm run typecheck`、`npm run lint`、`npm test` 的统一脚本。
- 逐步移除无意义或有风险的依赖，例如 npm 包 `crypto`、`https`，改用 Node 内置模块。
- 先升级低风险工具依赖，再处理原生模块和运行时依赖。

验收：

- 旧入口仍可启动。
- 现有测试和阶段 0 contract tests 通过。
- Docker 本地构建至少完成后端安装和启动验证。

### 阶段 2：配置层重构

目标：消除 `config.js` 的隐式副作用，同时保持配置文件兼容。

任务：

- 提取默认配置到 `src/config/defaults.ts`。
- 提取路径解析到 `src/config/paths.ts`，覆盖普通运行、Docker、`process.pkg`。
- 提取读写逻辑到 `src/config/loader.ts`，保留 `FREEZE_CONFIG_FILE`。
- 为配置对象增加 schema 校验和向后兼容补全。
- 保留 `config.js` 作为旧模块 facade，内部调用新配置层。
- 为 `setConfig`、`updateConfig`、`publicConfig.export()` 补测试。

验收：

- 不存在配置文件时仍能创建默认配置。
- 旧配置升级后字段齐全，secret 不被重置。
- `/api/config/admin`、`/api/config/shared` 响应不变。

### 阶段 3：数据库访问层隔离

目标：先把数据库调用从路由和扫描器里隔离出来，而不是直接换 ORM。

任务：

- 建立 `src/database/client.ts`，第一版包装现有 Knex 实例。
- 按领域拆 Repository：work、metadata、review、user、migration。
- 把 `database/db.js` 的导出逐步迁移到 Repository，但保留旧导出兼容。
- 为以下行为补 parity tests：
  - `getWorkMetadata`
  - `getWorksBy`
  - `getWorksByKeyWord`
  - `getWorksWithReviews`
  - `insertWorkMetadata`
  - `updateWorkMetadata`
  - `removeWork`
  - `createUser/updateUserPassword/deleteUser`
- 明确 `staticMetadata` 视图的输入输出结构，避免 ORM 重写时破坏 JSON 字段。
- 单独做 Drizzle + better-sqlite3 spike：用同一 SQLite fixture 比较查询结果、事务行为、迁移结果和性能。

验收：

- Repository 接管主要数据库调用，但 API 行为不变。
- 旧迁移测试通过。
- 是否切换 Drizzle 有明确数据，而不是预设结论。

### 阶段 4：认证与安全升级

目标：保留登录兼容，同时修复 MD5 密码债务。

任务：

- 抽象 password service：
  - 识别旧 MD5 hash。
  - 支持新 bcrypt/argon2 hash。
  - 旧用户登录成功后自动重哈希保存。
- 抽象 JWT service，统一 issuer、audience、expiresIn、query token 支持。
- 保持 `/api/auth/me` 登录和获取用户信息响应不变。
- 更新 Socket.IO 认证逻辑复用同一 JWT service。
- 为 admin 权限、普通用户、guest、未开启 auth 的路径补测试。

验收：

- 旧 MD5 用户可以登录。
- 登录后密码可升级为新 hash。
- 老 token 行为在过渡期内不破坏，或有明确版本策略。

### 阶段 5：路由模块 TypeScript 化

目标：逐个路由迁移，保持 `/api` 兼容。

推荐顺序：

1. `/api/health`、`/api/version`：低风险。
2. `/api/config`：依赖阶段 2。
3. `/api/auth`、`/api/credentials`：依赖阶段 4。
4. `/api/review`：依赖阶段 3。
5. `/api/work`、`/api/works`、`/api/search`、labels：依赖 Repository。
6. `/api/tracks`、`/api/cover`：依赖文件和媒体工具。
7. `/api/media/*`：最后迁移，因为涉及流、下载、编码和 offload。

任务：

- 每个路由模块先迁到 `src/modules/<name>/routes.ts`。
- 旧 `routes/*.js` 只做转发，或在迁移完成后删除。
- 新模块使用显式 request/response 类型。
- 参数验证可逐步从 express-validator 迁到 Zod，但不要一次性替换所有路由。
- 保持错误响应结构和状态码，除非有测试覆盖并明确记录 breaking change。

验收：

- 每迁移一个模块，相关 contract tests 通过。
- 前端无需改动即可正常使用。

### 阶段 6：媒体和文件系统模块重构

目标：稳定媒体服务和文件扫描规则。

任务：

- 把 `filesystem/utils.js` 拆成：
  - track list service
  - tree builder
  - RJ code formatter
  - cover storage
  - folder scanner
- 为 `formatRjCode` 增加边界测试，覆盖 6 位、8 位、更高位和奇偶位。
- 为 `getTrackList` 增加测试，覆盖音频、字幕、图片、PDF、嵌套目录和排序。
- 为 `toTree` 增加测试，覆盖 offload URL、Windows 路径、文本/图片/音频分类。
- 媒体流接口迁移时必须保留：
  - 文本和字幕 charset 检测。
  - `.flac` content-type。
  - offload 302。
  - `res.sendFile` 和 `res.download` 的安全路径处理。

验收：

- `/api/tracks/:id` 树结构与迁移前一致。
- `/api/media/stream` 和 `/api/media/download` 行为一致。

### 阶段 7：扫描器和爬虫模块重构

目标：把最长、最容易回归的流程拆开，并保留管理后台事件协议。

任务：

- 将扫描器状态从模块级全局数组封装为 `ScanSession`。
- 将扫描流程拆成：
  - 创建目录和数据库结构。
  - 清理不存在作品。
  - 遍历 root folders。
  - 去重。
  - 抓取静态/动态元数据。
  - 下载封面。
  - 写数据库。
  - 回报事件。
- 对 DLsite/HVDB 请求建立 mock，不让测试依赖外网。
- 保留 `process.send()` 消息格式。
- 改善错误处理：单任务失败不影响可恢复扫描，致命错误有明确退出码。
- 将 `LimitPromise` 并发限制封装，后续可替换实现。

验收：

- 管理后台 Socket.IO 事件不变。
- 子进程扫描能在 fixtures 上完成，并生成一致事件序列。
- `PERFORM_UPDATE --refreshAll/includeVA/includeTags/includeNSFW` 逻辑可测试。

### 阶段 8：Socket.IO 升级或替换评估

目标：先稳定协议，再决定是否升级或替换。

推荐策略：

- 第一轮保留 Socket.IO。
- 如果前端仍依赖 Socket.IO 2 客户端，后端不要单独升级到 Socket.IO 4。
- 如果要升级到 Socket.IO 4，需要前端同步升级，并建立真实浏览器或集成测试。
- 只有在明确接受前端协议重写时，才考虑替换为裸 `ws`。

任务：

- 文档化当前事件名、payload 和权限要求。
- 抽象 `ScannerSocketGateway`，避免业务逻辑直接依赖 Socket.IO API。
- 把 socket 认证和 HTTP JWT 认证复用同一模块。
- 验证 HTTP 和 HTTPS server 都能绑定 socket。

验收：

- 扫描页面刷新后仍能通过 `ON_SCANNER_PAGE` 恢复状态。
- 扫描中重复点击不会启动多个扫描进程。
- 鉴权开启时，非 admin 不能进入管理后台。

### 阶段 9：Web 框架替换评估

目标：在业务模块已经独立后，再决定是否替换 Express。

候选：

- 继续使用 Express 4/5：最低风险。
- Fastify：Node 生态成熟，性能和插件生态较好。
- Elysia：类型体验好，但 Node 部署需适配器验证，不能假设和 Bun 运行一致。

评估项：

- 静态前端服务。
- SPA fallback。
- `sendFile`/download/stream。
- HTTP/HTTPS server 接入。
- Socket.IO 接入。
- 错误处理中间件兼容。
- JWT、body parser、compression、proxy trust。
- Docker 和 `pkg`/桌面打包。
- 性能基准。

实施方式：

- 先为模块定义框架无关 service/repository。
- 再做一个最小 adapter spike，不迁移业务。
- 只有当 spike 通过所有验收，才安排框架切换。

验收：

- 框架替换不是必要条件。如果 Express 版本的 TypeScript 模块已经满足维护目标，可以停止在这里。

### 阶段 10：ORM 和 SQLite 驱动替换评估

目标：确认替换数据库层确实带来收益。

任务：

- 用 Drizzle 定义现有 schema，包括表、主键、外键、索引和 `staticMetadata` 视图策略。
- 对比 Knex 和 Drizzle 的 SQL 输出及查询结果。
- 验证 better-sqlite3 同步 API 在并发请求、扫描写入和媒体请求同时发生时不会造成明显阻塞。
- 验证 migration story：
  - 新库创建。
  - 旧库迁移。
  - 部分迁移失败回滚。
  - 用户数据备份和恢复。
- 如果收益不明显，保留 Knex Repository 也是可接受结果。

验收：

- 迁移前后所有 Repository parity tests 通过。
- 性能基准显示收益明确，或维护收益足够抵消迁移成本。

### 阶段 11：打包、部署和发布

目标：保证用户实际运行方式不被破坏。

任务：

- 更新 Dockerfile 到目标 Node LTS，验证前端构建和运行时镜像。
- 验证 Windows 本地运行、Linux Docker、HTTPS、反代 offload。
- 验证 `pkg` 或替代打包工具对目标 Node 版本和原生 SQLite 依赖的支持。
- 发布前自动备份：
  - `config/config.json`
  - `sqlite/db.sqlite3`
  - `covers/`
- 提供回滚说明：
  - 如何恢复旧二进制。
  - 如何恢复数据库。
  - 哪些迁移不可逆。
- 更新 `README.md` 和 `用户文档.md`。

验收：

- Docker volume 行为不变。
- 旧配置和旧数据库可直接升级。
- 失败后可按文档恢复。

## 建议执行顺序

最小可控路径如下：

1. 建基线测试和 fixtures。
2. 引入 TypeScript 工具链，但旧入口不动。
3. 重构配置层，保留 `config.js` facade。
4. 建 Repository，保留 Knex。
5. 修复认证密码哈希兼容升级。
6. 按风险从低到高迁移路由。
7. 重构媒体/文件工具。
8. 重构扫描器/爬虫。
9. 抽象 Socket 网关并决定是否升级 Socket.IO。
10. 决定是否替换 Web 框架。
11. 决定是否替换 ORM/SQLite 驱动。
12. 更新 Docker、桌面打包和发布文档。

## 第一批具体任务拆分

这些任务可以作为最初的 PR/commit 边界。

### PR 1：契约测试骨架

- 新增测试 fixtures 目录。
- 新增 API contract test helper。
- 覆盖 `/api/health`、`/api/auth/me`、`/api/config/shared`。
- 保留 Mocha，暂不换测试框架。

### PR 2：TypeScript 基础

- 新增 `tsconfig.json`。
- 新增 `npm run typecheck`。
- 新增 `src/types/`。
- 不迁移业务文件，只确认 JS/TS 可以共存。

### PR 3：配置 facade

- 新增 `src/config/defaults.ts`、`paths.ts`、`loader.ts`。
- `config.js` 改为调用新实现并保持导出不变。
- 增加配置创建、读取、升级、过滤测试。

### PR 4：数据库 Repository 外壳

- 新增 `src/database/client.ts`。
- 新增 user/review/work repository。
- `database/db.js` 暂时代理到新 repository。
- 增加 query parity tests。

### PR 5：认证服务

- 新增 password service 和 JWT service。
- 支持 MD5 旧密码登录后升级。
- HTTP 和 Socket.IO 共用认证逻辑。

### PR 6：低风险路由迁移

- 迁移 health/version/config/shared。
- 保持旧路径和响应。
- 每迁移一个路由补 contract test。

## 关键验收指标

- 旧数据库可以无人工干预启动。
- 旧配置可以无人工干预启动。
- 前端不改动时仍能登录、浏览、搜索、播放、下载、评价、扫描。
- Windows 路径和 Docker 路径都通过测试或手动验收。
- 扫描过程中刷新管理后台能恢复状态。
- 迁移任一阶段失败时，能回滚到上一阶段。

## 风险矩阵

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 数据库迁移破坏旧用户数据 | 极高 | 先做旧库 fixtures、备份、parity tests |
| Socket.IO 协议被破坏 | 高 | 第一轮保留协议，事件文档化 |
| 媒体流行为变化 | 高 | 针对 header、offload、字幕、下载补测试 |
| Elysia/Node 适配不完整 | 中高 | 放到后期 spike，不作为第一阶段依赖 |
| better-sqlite3 同步阻塞 | 中 | 用真实场景 benchmark，再决定是否切换 |
| `pkg` 不支持目标 Node/原生模块 | 中高 | 单独验证打包链，必要时选择替代工具或保留旧分支 |
| 配置文件写入副作用导致测试污染 | 中 | 保留并测试 `FREEZE_CONFIG_FILE` |
| DLsite 页面变化导致测试不稳定 | 中 | 使用 HTML/API fixtures 和 mock |

## 参考

- Node.js Release Working Group: https://github.com/nodejs/release
- Elysia Node adapter documentation: https://elysiajs.com/integrations/node
- Drizzle SQLite documentation: https://orm.drizzle.team/docs/get-started/sqlite-new
- Socket.IO documentation: https://socket.io/docs/v4/
