# Journal - tanggod (Part 1)

> AI development session journal
> Started: 2026-09-01

---



## Session 1: 恢复 ui-domain 专属域名回调链路

**Date**: 2026-09-03
**Task**: 恢复 ui-domain 专属域名回调链路
**Branch**: `ui-domain`

### Summary

从 69837cf8 的父提交按白名单恢复完整专属域名能力，保留 UI、Trellis 和 Compose；完成 TDD、全量测试、定向 race、前端构建及隔离 Host 路由验证。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6b05696e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: 完成主域名泛域匹配

**Date**: 2026-09-04
**Task**: 完成主域名泛域匹配
**Branch**: `codex/desktop-api-v2`

### Summary

完成 09-04-main-domain-wildcards：显式一级泛域 Host 匹配、具体 Host 同源 Cookie 校验、固定 OAuth/重置/支付回调与移除规则回归、Compose 具体 Host 探测。受影响包全量测试、race、根模块及 relaykit vet/build、make test、Compose 假环境渲染全部通过。任务已本地归档，既有四处未提交改动保留；未部署生产或执行远程 Git 操作。

### Main Changes

- 主域泛域配置、单 label 匹配和泛域 Host 的 HTTPS 同源校验。
- OAuth/重置/订单具体 Host 返回及旧规则移除回归。
- Compose 具体 Host 探测、配置示例和共享规范更新。

### Git Commits

| Hash | Message |
|------|---------|
| `5020c7f0` | ✨ feat(domain): 支持主域名泛域匹配 |

### Testing

- [OK] 受影响包全量测试、目标 race 检查、根模块与 relaykit vet/build、make test。
- [OK] Compose 隔离假配置渲染和健康检查命令行为回归。
- macOS race 构建产生链接器警告，测试全部通过且无竞态。

### Status

[OK] **Completed**

### Next Steps

- 本地任务完成；生产上线及 DNS/TLS/代理配置需要单独授权。
