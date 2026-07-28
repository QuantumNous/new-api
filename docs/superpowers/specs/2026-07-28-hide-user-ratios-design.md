# 隐藏普通用户倍率的长期维护设计

## 背景

`custom/hide-user-ratios` 分支用于在前端隐藏普通用户可见的分组倍率信息。该定制只改变展示层，不改变后端接口、数据库结构、计费逻辑和 Dockerfile 主构建链路，以便后续从上游 `origin/main` 升级时降低冲突概率。

## 目标

- 普通用户在新建或编辑 API Key 时看不到分组倍率。
- 普通用户在 API Key 列表中看不到分组倍率。
- 普通用户在使用日志列表中看不到分组倍率。
- 普通用户在使用日志详情的计费明细中看不到分组倍率。
- 管理员仍可看到倍率，用于运营和排障。
- 本地部署使用当前分支源码构建 `linux/amd64` 镜像，并通过 Docker Compose 启动。

## 非目标

- 不修改后端返回字段，避免影响 API 兼容性。
- 不修改数据库迁移、模型或计费计算。
- 不改项目名称、组织信息、镜像命名中的受保护标识。
- 不把本地镜像推送到远程仓库。

## 设计

倍率隐藏逻辑集中在前端展示边界，统一使用现有 `useIsAdmin()` 判断当前用户权限。普通用户仍可收到后端返回的数据，但 UI 不渲染倍率文本，也不允许通过分组下拉搜索倍率值命中分组。管理员路径保持原行为。

API Key 创建/编辑表单通过 `ApiKeyGroupCombobox` 的 `showRatio` 属性控制分组倍率徽标和搜索字段。API Key 列表在获取分组倍率时只对管理员启用查询，普通用户不额外请求分组倍率。使用日志列表和详情页在渲染明细时传入倍率可见性参数，普通用户不展示 `Group Ratio` 或 `User Exclusive Ratio`。

本机部署使用独立 compose 覆盖文件声明 `platform: linux/amd64`、本地镜像名和 Dockerfile 构建参数。原 `docker-compose.yml` 保持不变，后续升级时优先 rebase 上游，再重新运行测试和本机构建。

## 本机部署前置条件

- 本机需要安装 Docker Engine 或 Docker Desktop，并保证 `docker` 与 `docker compose` 命令在 PATH 中可用。
- Windows 本机前端构建若遇到安全策略拒绝读取 `OpenClaw` 依赖路径，可优先使用 Docker 容器内构建；容器内 Linux 文件系统不受该 Windows 路径限制影响。

## 升级流程

```bash
git fetch origin
git switch custom/hide-user-ratios
git rebase origin/main
cd web
bun install --frozen-lockfile
bun run typecheck
bun run build
cd ..
docker compose -f docker-compose.yml -f docker-compose.custom.yml up -d --build
```

如果 rebase 发生冲突，优先检查以下文件是否被上游重构：

- `web/src/features/keys/components/api-key-group-combobox.tsx`
- `web/src/features/keys/components/api-keys-mutate-drawer.tsx`
- `web/src/features/keys/components/api-keys-columns.tsx`
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx`
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx`

## 验收标准

- 受影响前端测试通过。
- `web` 类型检查通过。
- `web` 生产构建通过。
- Docker Compose 能用本地 `linux/amd64` 镜像启动 `new-api`。
- `new-api` 容器健康检查或 `/api/status` 返回成功状态。
