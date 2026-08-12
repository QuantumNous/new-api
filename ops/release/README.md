# Aibuff 发布总控 v1

这是一个只负责“精确打包、验包、发布前核对和单部署锁”的本地工具。它不连接生产、不执行 SSH、不运行 Docker/Nginx/数据库命令，也不保存地址、凭据或 Token。真正的生产适配器只能由获授权的运维实现接口；本目录不提供该适配器。

## 发布包里有什么

`prepare` 只接受干净的 Git checkout，并把当前 `HEAD` 的精确提交打成一个全新的目录：

- `release-manifest.json`：完整 candidate commit、tree、父提交列表、预期生产 commit/tree/image digest，以及两个制品的大小和 SHA-256。
- `source.tar.gz`：由 `git archive` 生成的精确源码归档，根目录固定为 `source/`。
- `source.bundle`：包含 candidate 可达历史的 Git bundle，并把 candidate 作为 bundle head。

输出目录已经存在时会直接停止，绝不覆盖。目录创建后出现错误时，该目录只能视为失败的临时产物，必须换一个新目录重做。

## 普通发布

普通发布的意思是：在基线之上完成已审查的变更，然后交给发布负责人。典型流程如下：

```text
干净 checkout
  -> prepare 精确源码 + bundle + manifest
  -> validate 二次验包
  -> 获得发布授权
  -> 在生产侧重新读取脱敏状态并执行 preflight
  -> acquire 单部署锁
  -> 由外部、已授权的部署适配器执行发布
  -> 保留回滚点/执行回滚方案
  -> release 锁
  -> 发布后再次核对 commit、tree、image digest 和业务健康度
```

示例（值必须由发布负责人提供，不要把示例值当成生产事实）：

```bash
python3 ops/release/release_controller.py prepare \
  --repo . \
  --output /tmp/aibuff-release-<new-directory> \
  --candidate <candidate-40-char-commit> \
  --expected-production-commit <production-40-char-commit> \
  --expected-production-tree <production-40-char-tree> \
  --expected-production-image-digest sha256:<64-lowercase-hex>

python3 ops/release/release_controller.py validate \
  --repo . \
  --manifest /tmp/aibuff-release-<new-directory>/release-manifest.json

python3 ops/release/release_controller.py preflight \
  --repo . \
  --manifest /tmp/aibuff-release-<new-directory>/release-manifest.json \
  --production-state /path/to/redacted-production-state.json
```

脱敏状态 JSON 只应包含这三个字段，不包含地址、凭据或 Token：

```json
{
  "commit": "<40-char-commit>",
  "tree": "<40-char-tree>",
  "image_digest": "sha256:<64-lowercase-hex>"
}
```

`preflight` 的三项必须全部与 manifest 的 expected 值相同；任意一项漂移都会打印 `HARD STOP` 并以非零状态退出。它不会“自动适配”漂移的生产环境。

## 紧急热修

紧急热修可以缩短评审和测试的范围，但不能缩短安全链路。热修必须从精确生产 commit 分支出来，并仍然完成：

1. 精确源码归档、bundle 和 manifest；
2. 第二次基线/制品校验；
3. 生产侧二次 preflight；
4. 单部署锁；
5. 可执行的回滚点与回滚方案；
6. 发布后 commit/tree/image digest 和业务健康验证。

热修不得以“生产很急”为理由跳过任何一项。若预期生产 commit 不是 candidate 的祖先，工具会停止；应先修复基线和授权，而不是强行打包。

## 单部署锁

```bash
python3 ops/release/release_controller.py lock acquire \
  --path /tmp/aibuff-deploy.lock \
  --owner-id <operator-or-job-id> \
  --ttl-seconds 1800 \
  --hold-seconds 60
```

锁使用原子创建。已有新鲜锁时，第二个任务立即失败；不排队、不覆盖。过期或格式损坏的锁同样是 `HARD STOP`，工具不会自动抢占或删除陈旧锁，必须人工核实后再用 owner 校验的 `lock release` 清理。超时/陈旧处理优先失败，避免两个任务同时认为自己拥有发布权。

若部署适配器需要跨越多个命令持有锁，可以不传 `--hold-seconds`，在外部部署完成后以相同 `--owner-id` 显式释放：

```bash
python3 ops/release/release_controller.py lock release \
  --path /tmp/aibuff-deploy.lock \
  --owner-id <operator-or-job-id>
```

## GitHub workflow

`.github/workflows/aibuff-release-gate.yml` 只运行 unittest、`prepare` 和 `validate`，上传 manifest/source archive/bundle。它只有 `contents: read` 权限，使用固定 concurrency group 且 `cancel-in-progress: false`。workflow 不读取 secrets，不 SSH，不部署，也不替代生产侧单锁和二次 preflight。

## 停止线

以下情况必须停止并人工处理：工作区脏、字段缺失或 hash 不是完整值、生产 commit/tree/image digest 漂移、生产 commit 不是 candidate 祖先、源码归档或 bundle 缺失/篡改、输出目录已存在、锁新鲜/陈旧/损坏或 owner 不匹配。所有这些路径均以非零状态退出，并在错误前显示 `HARD STOP`。
