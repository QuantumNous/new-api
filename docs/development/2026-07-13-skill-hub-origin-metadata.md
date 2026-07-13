# 技能广场来源元数据

技能广场技能新增两个可选字段：

- `origin`：来源名称，例如 `Clawhub`，最多 64 个 Unicode 字符。
- `originUrl`：源项目地址，最多 2048 个字符，必须是无用户凭据的 HTTP 或 HTTPS 绝对 URL。

字段由 GORM `AutoMigrate` 自动添加到 SQLite、MySQL 和 PostgreSQL 的 `skill_hub_skills` 表，旧数据默认留空。公开技能列表、推荐列表、按标签列表、详情接口以及对应管理员接口均返回这两个字段。

default 与 classic 管理页均支持编辑这两个字段。技能关键字搜索同时匹配来源和源地址。批量导出的 `manifest.json` 会保留字段，`scripts/skill-hub-batch-upload` 也会读取、校验并提交字段，保证导入导出往返不丢失来源信息。

`originUrl` 仅作为元数据保存和返回，服务端不会请求该地址，避免引入服务端请求伪造风险。
