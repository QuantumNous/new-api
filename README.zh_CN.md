<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **新一代大模型网关与 AI 资产管理系统**

**二次开发版本** —— 基于 [QuantumNous/new-api](https://github.com/QuantumNous/new-api)

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-brightgreen" alt="许可证">
  </a><!--
  --><a href="https://github.com/ChinaToyHunter/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/ChinaToyHunter/new-api?color=brightgreen&include_prereleases" alt="版本">
  </a>
</p>

</div>

## 📝 项目说明

> [!IMPORTANT]
> - 本项目仅面向合法授权的 AI API 网关、组织内部鉴权、多模型管理、用量统计、成本核算和私有化部署场景。
> - 使用者必须合法取得上游 API Key、账号、模型服务或接口权限，并遵守上游服务条款及适用法律法规。
> - 使用者应确保其使用方式符合上游服务条款及适用法律法规。
> - 面向公众提供生成式人工智能服务时，使用者应遵守适用监管要求，自行完成所在司法辖区要求的备案、许可、内容安全、实名、日志留存、税务和上游授权等合规义务。

---

## 🔀 本版本说明

本仓库是 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的二次开发版本，跟随上游 `main`，本文档只记录本版本新增或修改的内容。完整的上游功能和使用文档请参考 [docs.newapi.pro](https://docs.newapi.pro/zh/docs)。

### 📌 Situation｜背景

- 上游钱包额度使用单笔充值限制（`MaxQuota`，上限为 `math.MaxInt32`）。当 `QuotaPerUnit` 设置为 `500000` 等较高值时，多次充值、兑换码和管理员加额可能超过单次 int32 边界。
- 此时待支付金额可能静默计算为 `0`，而支付结算、兑换码和管理员加额路径此前没有统一的聚合钱包上限。

### 🎯 Task｜任务

- 在高 `QuotaPerUnit` 场景下保持充值金额正确，同时不破坏 Epay、Stripe 等既有支付流程。
- 增加所有额度增加路径共同遵守的聚合钱包上限；发生溢出或超过上限时必须 fail-closed，并兼容 SQLite、MySQL、PostgreSQL。

### 🛠️ Action｜行动

- 保留单笔充值的 int32 限制（`MaxQuota`），新增 int64 聚合上限 `MaxWalletQuota`（等值 $2,000,000），并在 `common/quota_math.go` 集中处理额度换算。
- 支付结算使用原子条件更新；兑换码和管理员 `add_quota` 操作先检查钱包余量，失败时拒绝写入而不是发生数值回绕。
- 将 Epay 价格和最低充值设置归入 Epay 设置页，明确其作用范围。
- 增加二次开发基础设施：带校验和验证、原子替换的一键自更新，Docker 拉取并重建，Compose 镜像同步，仅 root 可用的更新 API 与界面，服务端权威的邀请码模式，GitHub OAuth 最低账号年龄，以及按精确 tag 构建的发布 CI。

### 📈 Result｜结果

- `QuotaPerUnit=500000` 时待支付金额可正确计算；任何额度增加都不能超过 `MaxWalletQuota`。
- 额度增加路径具备溢出保护和并发安全，包括兑换码并发时只成功一次、支付结算原子执行。
- 已发布 [`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13)（合并提交 `ea0ba918`）。

### 🆚 快速对比

| 领域 | 上游（QuantumNous/new-api） | 本版本 |
|---|---|---|
| 钱包容量 | 仅有单笔 int32 限制 | 单笔 int32 + int64 聚合上限（$2,000,000） |
| 高 `QuotaPerUnit` 溢出 | 待支付金额可能静默变为 0 | 金额正确计算并 fail-closed |
| 兑换码 / 管理员加额 | 没有统一聚合上限 | 原子钱包余量检查 |
| Epay 设置 | 通用设置位置 | 收归 Epay 设置页 |
| 自更新 | 手动升级 | 校验和验证的一键更新、Docker 重建、Compose 同步 |
| 注册邀请码 | 单一全局开关 | 可选 / 必填 / 隐藏 |
| 版本号 | 上游 tag | `v{upstream}-th.{x}` 二次开发版本线 |

### 🏷️ 版本发布

本版本使用 `v{upstream}-th.{x}` 版本线，发布于 [Releases](https://github.com/ChinaToyHunter/new-api/releases)。当前版本：[`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13)。

---

## 📜 许可证

本项目采用 [GNU Affero 通用公共许可证 v3.0 (AGPLv3)](./LICENSE) 授权。

根据 AGPLv3 第 7 节的附加条款，修改版本必须在适当的法律声明以及用户界面展示的显著关于、法律、页脚或署名位置保留作者署名：`Frontend design and development by New API contributors.`。

包含用户界面的修改版本还必须保留指向原项目的可见链接：<https://github.com/QuantumNous/new-api>。

本项目是在 [One API](https://github.com/songquanpeng/one-api)（MIT 许可证）的基础上进行二次开发的开源项目。

如果您所在的组织政策不允许使用 AGPLv3 许可的软件，或您希望规避 AGPLv3 的开源义务，请发送邮件至：[support@quantumnous.com](mailto:support@quantumnous.com)

---

## 🌟 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=QuantumNous/new-api,ChinaToyHunter/new-api&type=Date)](https://star-history.com/#QuantumNous/new-api&ChinaToyHunter/new-api&Date)

</div>

如果本版本对你有帮助，欢迎为 ⭐️ [ChinaToyHunter/new-api](https://github.com/ChinaToyHunter/new-api) 点 Star；如果你直接使用上游项目，也欢迎为 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 点 Star。

---

<div align="center">

### 💖 感谢使用 New API

<sub>Built with ❤️ by QuantumNous</sub>

<sub>二次开发维护：<a href="https://github.com/ChinaToyHunter">ChinaToyHunter</a></sub>

</div>
