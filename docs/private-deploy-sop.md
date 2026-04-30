# new-api 私人定制部署 SOP（协作者版）

> 目的：所有私人化改动必须先进入 `Micah-Zheng/new-api` 的 `private/custom-ui`，再由服务器拉取该分支构建部署。禁止直接进生产容器改代码。

## 0. 当前协作关系

- 私人定制仓库：`https://github.com/Micah-Zheng/new-api`
- 私人部署基准分支：`private/custom-ui`
- 协作者：`jkjk02`，已邀请为仓库 `write` 权限协作者。
- 上游开源仓库：`https://github.com/QuantumNous/new-api`

约定：

- `private/custom-ui` 是唯一生产部署基准分支。
- 协作者不要直接 push 到 `private/custom-ui`。
- 协作者从 `private/custom-ui` 新建工作分支，改完后 PR 回 `private/custom-ui`。
- 服务器只从 `Micah-Zheng/new-api:private/custom-ui` 部署，不从个人工作分支部署。

## 1. 铁律

1. **不要直接修改容器里的代码。**
   - 不要 `docker exec` 进去改文件。
   - 不要在容器内 `vim`、`nano`、`sed -i` 改源码。
   - 不要在服务器构建目录里手改后直接重启。
2. **所有改动必须先进 Git。**
   - 本地改代码。
   - 提交到自己的工作分支。
   - 开 PR 到 `private/custom-ui`。
3. **生产服务器只做部署，不做开发。**
   - 服务器从 `Micah-Zheng/new-api:private/custom-ui` 拉代码。
   - 服务器本地构建 Docker 镜像。
   - 服务器更新 compose 里的镜像并重启容器。
4. **不要推到上游主分支。**
   - 上游 `QuantumNous/new-api` 只用于同步更新或提交通用 bugfix PR。
   - 私人定制不要推给上游。

## 2. 为什么不能直接改容器

直接改容器会导致：

- 容器重建后改动立刻丢失。
- GitHub `private/custom-ui` 里没有这次改动，其他人拉不到。
- 下次从 `private/custom-ui` 部署会覆盖掉容器内手改内容。
- 两个人各改一边时无法 merge，最后只能人工猜哪个是最新。
- 无法回滚、无法审计、无法知道线上到底跑了哪些改动。

一句话：**容器内手改 = 临时热修，不是正式交付。除非救火，否则不要做。**

## 3. 推荐远端命名

协作者本地建议这样配置：

```text
origin   = https://github.com/Micah-Zheng/new-api.git      # 私人定制仓库，日常协作目标
upstream = https://github.com/QuantumNous/new-api.git      # 开源上游，只用于同步
```

如果 `git clone` 的就是 `Micah-Zheng/new-api`，默认 `origin` 就是私人定制仓库。

检查远端：

```bash
git remote -v
```

如果缺少上游远端，可添加：

```bash
git remote add upstream https://github.com/QuantumNous/new-api.git
```

## 4. 分支模型

```text
main                 # 跟踪上游，不放私人定制
private/custom-ui    # 私人定制部署基准分支，只通过 PR 合并
teammate/xxx         # 协作者工作分支，从 private/custom-ui 新建
fix/xxx              # bugfix 工作分支，从 private/custom-ui 或 main 新建，视用途决定
```

不要给自己的工作分支也起名 `private/custom-ui`，否则很容易和部署基准分支混淆。

## 5. 协作者开始改代码前必须做

```bash
cd /path/to/new-api

git fetch origin
git switch private/custom-ui
git pull --ff-only origin private/custom-ui

git switch -c teammate/short-description

git status --short --branch
```

确认自己在工作分支上，例如：

```text
## teammate/short-description
```

如果有未提交改动，先不要继续，先确认这些改动是谁的。

## 6. 本地修改和验证

修改代码后先看 diff：

```bash
git diff
```

前端改动推荐验证：

```bash
cd web/default
bun run typecheck
bun run build
```

如果本机没有 Go 或 Docker，至少保证前端检查通过；后端编译会在服务器 Docker build 时再验证。

## 7. 提交到自己的工作分支

```bash
cd /path/to/new-api

git status --short
git add <你改过的文件>
git commit -m "简短说明这次改动"
```

提交后确认：

```bash
git log --oneline -3
```

## 8. 推送工作分支并开 PR

正确命令：

```bash
git push -u origin teammate/short-description
```

然后在 GitHub 上开 PR：

```text
base:    Micah-Zheng/new-api:private/custom-ui
compare: Micah-Zheng/new-api:teammate/short-description
```

禁止命令：

```bash
# 不要直接推部署基准分支
git push origin private/custom-ui

# 不要推上游主分支
git push upstream main
```

PR 合并后，`private/custom-ui` 才会进入部署候选状态。

## 9. 服务器部署原则

服务器生产信息：

```text
compose 目录：/opt/new-api
服务名：new-api
数据库服务：new-api-postgres
部署分支：private/custom-ui
部署仓库：https://github.com/Micah-Zheng/new-api.git
```

部署原则：

- 只从 `private/custom-ui` 部署。
- 不从 `teammate/*`、`fix/*`、个人 fork 分支部署。
- 部署前确认 PR 已合并，且 `private/custom-ui` 是最新。

## 10. 服务器部署命令

在服务器执行：

```bash
set -euo pipefail

BUILD_DIR="$HOME/new-api-custom-ui-src"
BRANCH="private/custom-ui"
REPO="https://github.com/Micah-Zheng/new-api.git"
IMAGE="new-api:custom-ui-$(date +%Y%m%d%H%M%S)"

if [ ! -d "$BUILD_DIR/.git" ]; then
  rm -rf "$BUILD_DIR"
  git clone --branch "$BRANCH" --single-branch "$REPO" "$BUILD_DIR"
else
  git -C "$BUILD_DIR" remote set-url origin "$REPO"
  git -C "$BUILD_DIR" fetch origin "$BRANCH"
  git -C "$BUILD_DIR" switch "$BRANCH" >/dev/null 2>&1 || git -C "$BUILD_DIR" checkout -B "$BRANCH"
  git -C "$BUILD_DIR" reset --hard FETCH_HEAD
fi

cd "$BUILD_DIR"
echo "deploy_commit=$(git rev-parse HEAD)"
docker build -t "$IMAGE" .
echo "$IMAGE" > "$HOME/.new-api-last-custom-image"
```

然后更新生产 compose：

```bash
set -euo pipefail

IMAGE="$(cat "$HOME/.new-api-last-custom-image")"
cd /opt/new-api

BACKUP="docker-compose.yml.backup-$(date +%Y%m%d%H%M%S)"
sudo cp docker-compose.yml "$BACKUP"

echo "backup=/opt/new-api/$BACKUP"
echo "deploy_image=$IMAGE"

sudo python3 - <<PY
from pathlib import Path
image = "$IMAGE"
path = Path("docker-compose.yml")
text = path.read_text()
lines = text.splitlines()
for idx, line in enumerate(lines):
    if line.strip().startswith("image:") and "new-api" in line:
        lines[idx] = f"    image: {image}"
        break
else:
    raise SystemExit("new-api image line not found")
path.write_text("\n".join(lines) + "\n")
PY

sudo docker compose up -d new-api
```

## 11. 部署后验证

```bash
docker ps --filter name=^new-api$ --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

docker inspect new-api --format 'image={{.Config.Image}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{end}} started={{.State.StartedAt}}'

wget -qO- http://127.0.0.1:33030/api/status | head -c 500; echo
```

正常结果：

- `new-api` 容器是 `Up`。
- health 是 `healthy`。
- `/api/status` 返回 JSON。
- 镜像名是本次生成的 `new-api:custom-ui-时间戳`。

## 12. 如果线上需要紧急修复

可以临时热修，但必须按下面流程补回 Git：

1. 在容器/服务器临时修复前，先记录：

```bash
docker inspect new-api --format '{{.Config.Image}}'
git -C "$HOME/new-api-custom-ui-src" rev-parse HEAD
```

2. 临时修复后，立刻在本地从 `private/custom-ui` 新建工作分支并复现同样改动。
3. 本地提交并开 PR：

```bash
git fetch origin
git switch private/custom-ui
git pull --ff-only origin private/custom-ui
git switch -c hotfix/short-description
# 复现热修改动
git add <files>
git commit -m "backport production hotfix"
git push -u origin hotfix/short-description
```

4. PR 合并后，重新按第 10 节部署一次，让线上回到 Git 可追踪状态。

如果热修没有补回 Git，下一次部署一定会丢。

## 13. 同步上游更新时怎么做

不要在 `main` 上放私人代码。

```bash
cd /path/to/new-api

git fetch upstream
git fetch origin

git switch private/custom-ui
git pull --ff-only origin private/custom-ui
git merge upstream/main
```

如果有冲突：

1. 只解决和私人定制相关的冲突。
2. 不要顺手改无关文件。
3. 解决后运行检查。
4. 提交 merge commit。
5. 推送到私人仓库：

```bash
git push origin private/custom-ui
```

同步上游这一步通常由仓库负责人做；协作者不确定时不要自行操作。

## 14. 上游 PR 和私人定制要隔离

如果要给上游提交 bugfix：

```bash
git switch main
git pull --ff-only upstream main
git switch -c fix/some-bug
```

规则：

- 上游 PR 分支只放通用 bugfix。
- 不要从 `private/custom-ui` 开上游 PR。
- 不要把私人 logo、私人 UI、私人部署配置提交给上游。

## 15. 最常用命令速查

协作者日常改私人定制：

```bash
git fetch origin
git switch private/custom-ui
git pull --ff-only origin private/custom-ui
git switch -c teammate/short-description
# 修改代码
git add <files>
git commit -m "message"
git push -u origin teammate/short-description
```

然后开 PR：

```text
base:    private/custom-ui
compare: teammate/short-description
```

确认当前没有跑错分支：

```bash
git status --short --branch
git remote -v
```

确认部署基准分支位置：

```bash
git ls-remote --heads origin private/custom-ui
```

## 16. 最后提醒

生产环境只有一个可信来源：

```text
Micah-Zheng/new-api:private/custom-ui
```

服务器和容器只是这个分支的构建结果。任何不进入这个分支的改动，都视为临时改动，随时会被下一次部署覆盖。
