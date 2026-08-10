# 多副本本地缓存一致性策略

本文档说明 new-api 多副本部署下本地磁盘缓存不跨 Pod 共享的事实、影响，以及三种应对策略与选择依据。

对应 issue #75。基础清单见 PR #77（issue #73）；运行约束背景见 `docs/k8s/runtime-constraints.md` 第 6 节。

## 1. 缓存机制与默认状态

new-api 在处理大体积文件（图片/音频/视频的 base64 数据）时，可选择把数据写入本地磁盘而非常驻内存，以降低内存占用：

- 目录常量：`new-api-body-cache`（依据：`common/disk_cache.go:21`）
- 写入判断：`common.ShouldUseDiskCache`（`common/disk_cache.go`），调用方 `service/file_service.go:239-246`
- 配置结构：`common/disk_cache_config.go:9-18` 的 `DiskCacheConfig`

**默认关闭**。磁盘缓存默认 `Enabled: false`（依据：`common/disk_cache_config.go:21-26` 与 `setting/performance_setting/config.go:30-34`）：

| 配置项 | 默认值 | 含义 |
|---|---|---|
| `DiskCacheEnabled` | `false` | 是否启用磁盘缓存 |
| `DiskCacheThresholdMB` | `10` | 超过该体积才写磁盘 |
| `DiskCacheMaxSizeMB` | `1024` | 磁盘缓存总量上限 |
| `DiskCachePath` | `""`（系统临时目录） | 缓存目录 |

默认关闭时，大文件走内存缓冲，不产生跨 Pod 一致性问题。只有在「系统设置 → 性能设置」里显式开启磁盘缓存后，本文档讨论的多副本问题才出现。

## 2. 多副本下的问题

每个 Pod 拥有独立的容器文件系统。启用磁盘缓存后：

- 同一个远端文件可能被多个 worker Pod 各自下载并缓存，互不复用
- 缓存命中率随副本数增加而下降（N 个副本最坏要各缓存一次）
- 磁盘占用总量约为单副本的 N 倍

请求体临时文件（`common/body_storage.go:129`、`body_storage.go:161` 创建，关闭时删除）生命周期限于单请求，不受多副本影响，本文档不涉及。

## 3. 三种策略

### 策略 A：内存优先（推荐默认）

保持磁盘缓存关闭，或把阈值调得很高，让绝大多数请求走内存缓冲。

- 配置：`DiskCacheEnabled: false`（默认），或 `DiskCacheThresholdMB` 设为一个很少触发的大值
- 优点：无跨 Pod 一致性问题，无额外存储依赖，行为最简单
- 代价：大文件常驻内存，worker 需要更高内存 limit；`k8s/new-api-worker.yaml` 中 worker 内存 limit 应据此评估
- 适用：图片/音频/视频请求量不大，或单文件不极端的部署

### 策略 B：共享缓存卷（ReadWriteMany）

给所有 worker 挂载同一个 `ReadWriteMany`（RWX）持久卷作为缓存目录，让副本间共享缓存。

- 配置要点：
  - 需要支持 RWX 的存储（如 NFS、CephFS；`ReadWriteOnce` 的本地卷不行）
  - worker 的 `DiskCachePath` 指向挂载点，并 `DiskCacheEnabled: true`
  - 在 `k8s/new-api-worker.yaml` 增加 `volumeMounts` + `volumes`（PVC 引用 RWX 卷）
- 优点：缓存跨副本复用，命中率与单实例相当，磁盘占用不随副本翻倍
- 代价：引入网络文件系统的 I/O 延迟与单点/性能瓶颈；并发写同名缓存文件需存储层保证一致性
- 适用：大文件多、内存吃紧、且已有可靠 RWX 存储

> 注意：本 PR 不修改 `k8s/new-api-worker.yaml`。若采用策略 B，卷挂载改动应作为独立变更提交，并复核 `common/disk_cache.go` 的并发写行为。

### 策略 C：接受各 Pod 独立缓存

启用磁盘缓存但不共享，接受命中率下降。

- 配置：`DiskCacheEnabled: true`，每个 Pod 用自己的 `emptyDir` 或本地卷
- 优点：降低内存占用，配置简单，无 RWX 依赖
- 代价：缓存命中率随副本数下降，磁盘总量约 N 倍；`emptyDir` 随 Pod 重建清空
- 适用：内存比磁盘紧张，但又没有 RWX 存储，且能接受重复下载

## 4. 选择建议

| 部署特征 | 推荐策略 |
|---|---|
| 默认 / 文件请求不多 | A 内存优先（保持默认关闭） |
| 大文件多 + 有可靠 RWX 存储 | B 共享卷 |
| 大文件多 + 无 RWX + 内存紧张 | C 各自缓存 |

默认交付形态是策略 A（磁盘缓存关闭）。改用 B 或 C 都需要显式开启并调整 worker 清单，属于独立于 #77 骨架的后续变更。

## 5. 与 worker 资源配置的关系

- 选 A：worker 内存 limit 要能容纳峰值大文件缓冲，参考 `k8s/new-api-worker.yaml` 的 `resources.limits.memory`，必要时上调。
- 选 B/C：可下调内存 limit，但要相应规划磁盘容量（B 规划 RWX 卷容量，C 规划每 Pod 本地卷容量）。
- 无论哪种，`DiskCacheMaxSizeMB` 都应小于所在卷/内存的可用量，避免写满。

## 6. 检查清单

- [ ] 确认是否真的需要磁盘缓存（默认关闭已满足多数场景）
- [ ] 若保持关闭，确认 worker 内存 limit 能容纳峰值文件缓冲
- [ ] 若启用共享卷，确认存储支持 `ReadWriteMany` 且 `DiskCachePath` 指向挂载点
- [ ] 若各自缓存，确认能接受命中率下降与 N 倍磁盘占用
- [ ] `DiskCacheMaxSizeMB` 不超过对应卷/内存可用量
