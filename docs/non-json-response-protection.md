# 非 JSON 网关响应保护

2026-09-08 已发布本站前端保护，版本 `hardy-http-guard-20260908-152518`，源码提交 `26d7be6d`。发布经 `hardy-app` 受限账号执行，运行镜像 `sha256:ebbe10b60ba984cb1aaa9d28769dfa6fa94832b75806b77bb596d19c690d7509`，二进制 SHA256 `b15f6a0c1c4e73ed733b7c91bdd2010b52b5f7eac624d45fae44e3c772ef9af8`。

本站 Axios JSON 请求在业务处理前拒绝 HTML、未能解析的文本和截断 JSON，统一显示“服务暂时不可用或返回异常。生图请求请先查看任务记录，再决定是否重新提交。”成功的图片 Blob、HTTP 204 和有效 JSON 保留原行为。HTML 401 不会触发认证重试；认证刷新收到非 JSON 时按临时故障处理，避免误清登录状态。没有新增生图自动重试。

本站改动不等于已经修改客户自己的客户端。外部调用方可采用 [image-client.mjs](examples/image-client.mjs) 中的 `requestImage`，或只用 `readImageResponse` 替换直接调用 `response.json()` 的代码。该示例检查状态、JSON Content-Type 和解析结果，保留有效 JSON 错误码、状态码及可取得的请求标识；发生网络或网关故障不会自动重放付费请求。接入报错的实际客户程序仍需其项目路径或源码。

验证：36 项相关前端测试、5 项外部客户端示例测试、类型检查、涉及文件 lint 和生产构建通过。Chrome 使用生产构建加模拟上游，提交一次请求后收到 HTTP 530 HTML；页面显示中文提示，fixture 计数确认只提交一次。未调用收费模型。

发布后 `/api/status` 返回新版本和 `application/json`；公网入口脚本 `/static/js/index.910cd5bedb.js` 包含新保护代码及中文文案。应用 healthy，运行用户 `995:985`，capabilities 全部移除，启用 no-new-privileges，图片目录和日志目录可写。未重新加载主网卡，网络保护当前无待回退事务。

本次发布前恢复点：`/var/backups/hardy-dr/20260908T073057Z-be1d66`。完整 PostgreSQL 恢复演练已通过；该包对应发布前 Base64 版本，约 321 MB，当前仍仅保存在主机上，不能标记为异地备份。独立节点部署状态见 [容灾准备](../ops/disaster-recovery/README.md)。
