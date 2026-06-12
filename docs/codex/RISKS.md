# Risks

## 2026-06-12 - 工作区已有未提交变更

- 风险描述：当前 `master` 比 `origin/master` 超前 1 个提交，且 `AGENTS.md`、`README.md` 已修改，`.agents/REVIEW_SECURITY.md`、`.agents/WORKFLOW.md`、`scripts/codex-check.ps1` 未跟踪。
- 影响范围：后续开发、审查、提交时容易混入既有改动。
- 当前处理：本次只新增 `docs/codex/*`，不触碰已有修改文件。
- 建议处理时间：提交或继续业务开发前。
- 是否阻塞发布：否，但发布前应确认这些变更归属。

## 2026-06-12 - 当前 README.md 与项目真实说明不一致

- 风险描述：当前 `README.md` 内容是 Codex 规则包说明，而 `README.en.md` 才包含 New API 项目介绍和部署说明。
- 影响范围：新成员或自动化流程如果默认读取 `README.md`，可能误判项目用途和启动方式。
- 当前处理：项目上下文改用 `README.en.md`、`docs/project-map.md`、源码配置和部署文件作为依据。
- 建议处理时间：整理项目文档或提交当前 README 变更前。
- 是否阻塞发布：否。

## 2026-06-12 - Compose 示例包含默认数据库和 Redis 密码

- 风险描述：`docker-compose.yml` 与开发 Compose 中出现 `root:123456`、Redis `123456` 等默认凭据，文件内已有生产修改提醒。
- 影响范围：如果直接把示例配置用于生产，可能造成数据库或缓存暴露风险。
- 当前处理：仅记录风险，不修改部署配置。
- 建议处理时间：任何生产部署或公网演示前。
- 是否阻塞发布：生产发布前应视为阻塞。

## 2026-06-12 - Go 版本声明存在不一致

- 风险描述：`go.mod` 声明 `go 1.25.1`，`Dockerfile` 与 `Dockerfile.dev` 使用 `golang:1.26.1-alpine`，`go.mod` 中还有 Heroku `go1.18` 注释。
- 影响范围：本地、Docker、PaaS 构建环境可能出现行为或兼容性差异。
- 当前处理：仅记录，未调整 toolchain 或镜像。
- 建议处理时间：统一构建环境、CI 或发布镜像前。
- 是否阻塞发布：视发布环境而定。

## 2026-06-12 - Makefile 前端版本注入可能为空

- 风险描述：`makefile` 的前端构建命令使用 `VITE_REACT_APP_VERSION=$(cat ../../VERSION)`，在 Make recipe 中可能被 Make 当作变量展开而非 shell 命令，导致版本值为空。
- 影响范围：通过 `make build-frontend`、`make build-frontend-classic` 构建时，前端版本元数据可能不正确。
- 当前处理：仅记录，未修改 Makefile。
- 建议处理时间：依赖 Makefile 构建发布前。
- 是否阻塞发布：如果发布流程使用 Makefile 构建前端，则应阻塞。

## 2026-06-12 - Codex 检查脚本可能漏跑前端

- 风险描述：`scripts/codex-check.ps1` 当前在仓库根目录检测 package manager，但前端 package 和 `bun.lock` 位于 `web/`；因此统一检查可能只运行 Go 测试，漏掉 `web/default` 与 `web/classic` 的 typecheck/lint/build。
- 影响范围：使用该脚本作为唯一验证入口时，前端问题可能未被发现。
- 当前处理：在 `PROJECT_CONTEXT.md` 中单独列出前端验证命令。
- 建议处理时间：把 Codex 检查脚本纳入团队默认检查前。
- 是否阻塞发布：否，但前端发布前需手动补跑对应命令。

## 2026-06-12 - Codex 检查脚本在当前 PowerShell 环境解析失败

- 风险描述：执行 `powershell -ExecutionPolicy Bypass -File .\scripts\codex-check.ps1` 时出现 `Unexpected token '}'` 和字符串未闭合错误；同一文件用 UTF-8 读取显示正常，疑似 Windows PowerShell 对 UTF-8 无 BOM 中文脚本的解析问题或脚本文件编码问题。当前环境未安装 `pwsh`。
- 影响范围：团队如果依赖该脚本做统一验证，在 Windows PowerShell 5 环境可能无法启动检查。
- 当前处理：不修改脚本时，可用 `Get-Content -Raw -Encoding UTF8 .\scripts\codex-check.ps1 | Invoke-Expression` 做等价执行；必须同时保留直接执行失败的原始结果，不能把替代命令描述成直接脚本通过。
- 建议处理时间：将该脚本作为默认验收入口前。
- 是否阻塞发布：否，但会阻塞该脚本自身作为验收工具使用。

## 2026-06-12 - 默认前端全量 TypeScript 检查受依赖类型声明缺失阻塞

- 风险描述：`web/default` 执行 `tsc -b` 时，现有代码普遍报 `Cannot find module 'hast'` 和 `Cannot find module '@hugeicons/core-free-icons' or its corresponding type declarations`；Hugeicons 错误覆盖多个既有 UI 组件，并非单一业务组件特有。
- 影响范围：全量 typecheck 当前不能作为业务组件是否正确的唯一判断依据，新使用项目标准 Hugeicons 的文件也会被同一基础问题命中。
- 当前处理：前端改动需补跑目标文件 ESLint、Prettier 和 Rsbuild 生产构建，并确认 typecheck 输出中是否存在目标组件独有的逻辑或类型错误；不要为单个 UI 任务安装依赖或修改 lockfile 来掩盖仓库级问题。
- 建议处理时间：团队统一前端依赖和 TypeScript 验证基线时。
- 是否阻塞发布：视生产构建结果而定；若 Rsbuild 也失败则阻塞。

## 2026-06-12 - Windows 下前端构建入口不是 rsbuild.cmd

- 风险描述：当前 Bun 安装生成的是 `node_modules/.bin/rsbuild.exe` 与 `rsbuild.bunx`，不存在常见的 `node_modules/.bin/rsbuild.cmd`。
- 影响范围：按 npm 风格调用 `.\node_modules\.bin\rsbuild.cmd build` 会立即失败，造成错误的构建结论。
- 当前处理：未使用 Bun CLI 时，可靠入口为 `node node_modules\@rsbuild\core\bin\rsbuild.js build`；正常开发仍优先使用项目声明的 `bun run build`。
- 建议处理时间：立即作为 Windows 本地验证约定使用。
- 是否阻塞发布：否。

## 2026-06-12 - 两套前端生产构建不宜在本机并行执行

- 风险描述：同时运行 `web/default` 与 `web/classic` 的 Rsbuild 生产构建时，两者均持续 5 分钟无结果并被超时终止，未输出具体编译错误；并行构建会争用 CPU、内存和磁盘，降低验证效率。
- 影响范围：容易把资源争用或构建耗时误判为代码失败，也会拖慢其他本地检查。
- 当前处理：后续重型构建必须串行，先构建本次实际使用的前端，再按需要构建另一套；在已有 ESLint、Prettier 和定向检查通过时，不重复并行启动 Docker 构建与本地生产构建。
- 建议处理时间：每次前端验证时。
- 是否阻塞发布：否，但发布前仍需至少完成实际启用前端的一次成功构建。

## 2026-06-12 - Docker restart 中断后会留下无运行容器状态

- 风险描述：`scripts/windows/project.ps1 restart` 会先停止现有容器，再构建新镜像；如果构建期间退出 Codex、终止命令或 Docker Desktop 停止，应用容器不会自动恢复，`docker ps` 可能显示 0 个容器。
- 影响范围：本地站点会暂时不可访问，且长时间安静输出容易被误判为构建卡死。
- 当前处理：启动前先确认用户是否需要本轮代为重建；运行后保持同一命令会话并等待完成，不并发启动第二次构建。若用户要求跳过，终止当前构建并明确由用户执行 `powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 restart` 恢复。
- 建议处理时间：每次 Docker 实机验收前。
- 是否阻塞发布：否，但会阻塞本地人工验收。
