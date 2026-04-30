# new-api 私人定制部署 SOP（同事版）

> 目的：所有私人化改动必须先进入 GitHub 私有分支 `private/custom-ui`，再由服务器拉取该分支构建部署。禁止直接进生产容器改代码。

## 0. 铁律

1. **不要直接修改容器里的代码。**
   - 不要 `docker exec` 进去改文件。
   - 不要在容器内 `vim`、`nano`、`sed -i` 改源码。
   - 不要在服务器构建目录里手改后直接重启。
2. **所有改动必须先进 Git。**
   - 本地改代码。
   - 提交到 `private/custom-ui`。
   - 推送到自己的 fork：`fork/private/custom-ui`。
3. **生产服务器只做部署，不做开发。**
   - 服务器从 `fork/private/custom-ui` 拉代码。
   - 服务器本地构建 Docker 镜像。
   - 服务器更新 compose 里的镜像并重启容器。
4. **不要推到上游主分支。**
   - 上游远端 `origin` 是 `QuantumNous/new-api`。
   - 私人定制只推 `fork`，不要推 `origin`。

## 1. 为什么不能直接改容器

直接改容器会导致：

- 容器重建后改动立刻丢失。
- GitHub 私有分支里没有这次改动，其他人拉不到。
- 下次从 `private/custom-ui` 部署会覆盖掉容器内手改内容。
- 两个人各改一边时无法 merge，最后只能人工猜哪个是最新。
- 无法回滚、无法审计、无法知道线上到底跑了哪些改动。

一句话：**容器内手改 = 临时热修，不是正式交付。除非救火，否则不要做。**

## 2. 正确分支模型

远端约定：

```text
origin = https://github.com/QuantumNous/new-api.git      # 上游，只读为主
fork   = 你自己的 GitHub fork                            # 私人部署分支推这里
```

分支约定：

```text
main                 # 跟踪上游，不放私人定制
private/custom-ui    # 私人定制部署分支，所有定制都在这里
```

## 3. 开始改代码前必须做

```bash
cd /path/to/new-api

git fetch origin
git fetch fork

git switch private/custom-ui
git pull --ff-only fork private/custom-ui

git status --short --branch
```

确认输出类似：

```text
## private/custom-ui...fork/private/custom-ui
```

如果有未提交改动，先不要继续，先确认这些改动是谁的。

## 4. 本地修改和验证

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

## 5. 提交到 private 分支

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

## 6. 只推 fork，不推 origin

正确命令：

```bash
git push fork private/custom-ui
```

禁止命令：

```bash
# 不要执行
git push origin private/custom-ui

# 不要执行
git push origin main
```

推送后确认远端：

```bash
git ls-remote --heads fork private/custom-ui
```

## 7. 服务器部署流程

服务器生产信息：

```text
compose 目录：/opt/new-api
服务名：new-api
数据库服务：new-api-postgres
部署分支：private/custom-ui
仓库：你的 fork，例如 https://github.com/Micah-Zheng/new-api.git
```

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

## 8. 部署后验证

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

## 9. 如果线上需要紧急修复

可以临时热修，但必须按下面流程补回 Git：

1. 在容器/服务器临时修复前，先记录：

```bash
docker inspect new-api --format '{{.Config.Image}}'
git -C "$HOME/new-api-custom-ui-src" rev-parse HEAD
```

2. 临时修复后，立刻在本地 `private/custom-ui` 复现同样改动。
3. 本地提交并推送：

```bash
git switch private/custom-ui
git pull --ff-only fork private/custom-ui
# 复现热修改动
git add <files>
git commit -m "backport production hotfix"
git push fork private/custom-ui
```

4. 重新按第 7 节部署一次，让线上回到 Git 可追踪状态。

如果热修没有补回 Git，下一次部署一定会丢。

## 10. 同步上游更新时怎么做

不要在 `main` 上放私人代码。

```bash
cd /path/to/new-api

git fetch origin
git fetch fork

git switch private/custom-ui
git pull --ff-only fork private/custom-ui
git merge origin/main
```

如果有冲突：

1. 只解决和私人定制相关的冲突。
2. 不要顺手改无关文件。
3. 解决后运行检查。
4. 提交 merge commit。
5. 推送：

```bash
git push fork private/custom-ui
```

然后再部署。

## 11. 上游 PR 和私人定制要隔离

如果要给上游提交 bugfix：

```bash
git switch main
git pull --ff-only origin main
git switch -c fix/some-bug
```

规则：

- 上游 PR 分支只放通用 bugfix。
- 不要从 `private/custom-ui` 开 PR。
- 不要把私人 logo、私人 UI、私人部署配置提交给上游。

## 12. 最常用命令速查

日常改私人定制：

```bash
git switch private/custom-ui
git pull --ff-only fork private/custom-ui
# 修改代码
git add <files>
git commit -m "message"
git push fork private/custom-ui
```

确认当前没有跑错分支：

```bash
git status --short --branch
git remote -v
```

确认没推上游：

```bash
git ls-remote --heads fork private/custom-ui
git ls-remote --heads origin private/custom-ui
```

第二条如果没有输出，说明上游没有这个私人分支，是正常的。

## 13. 最后提醒

生产环境只有一个可信来源：

```text
GitHub fork/private/custom-ui
```

服务器和容器只是这个分支的构建结果。任何不进入这个分支的改动，都视为临时改动，随时会被下一次部署覆盖。
