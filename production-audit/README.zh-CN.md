# 生产服务器代码快照与审计

本目录保存 2026-07-20 从生产服务器拉取的代理代码快照、历史备份和服务器/GitHub 完整性审计材料。

## 目录边界

| 目录 | 内容 | 是否可部署 |
|---|---|---|
| `server-snapshot/` | 服务器审计时实际安装的旧版代理和 systemd 配置 | 否，仅用于比较和回滚参考 |
| `server-history/` | 服务器保留的五份代理历史备份 | 否，仅用于追溯 |
| `docs/` | 全部修改总结和完整性审计报告 | 不适用 |

最终可部署代码仍位于仓库根目录的 `deploy/`。不要从本目录直接覆盖生产文件。

## 核对结果

- `server-snapshot/retry-proxy/gpt56_retry_proxy.py` 与提交 `ee21ec8` 完全一致；
- 根目录 `deploy/retry-proxy/gpt56_retry_proxy.py` 是最终版本，包含后续流式早期失败修复和严格 64 KiB 前导缓冲上限；
- `server-history/` 中包含已回滚的 `/v1/messages -> /v1/chat/completions` 转换实验，该实现不属于最终生产契约；
- 完整结论见 `docs/SERVER_GITHUB_COMPLETENESS_AUDIT.zh-CN.md`。

## 安全边界

本目录不得包含生产服务器地址、SSH 私钥、API Key、Token、数据库密码、完整 DSN、用户数据、渠道密钥或数据库 dump。
