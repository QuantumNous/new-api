<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **Next-Generation LLM Gateway and AI Asset Management System**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <strong>English</strong> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a>
</p>

**Secondary-Development Fork** by ChinaToyHunter — based on [New API by QuantumNous](https://github.com/QuantumNous/new-api)

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-brightgreen" alt="license">
  </a><!--
  --><a href="https://github.com/ChinaToyHunter/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/ChinaToyHunter/new-api?color=brightgreen&include_prereleases" alt="release">
  </a>
</p>

</div>

## 📝 Project Description

> [!IMPORTANT]
> - This project is intended solely for lawful and authorized AI API gateway, organization-level authentication, multi-model management, usage analytics, cost accounting, and private deployment scenarios.
> - Users must lawfully obtain upstream API keys, accounts, model services, and interface permissions, and must comply with upstream terms of service and applicable laws and regulations.
> - Users should ensure their use complies with upstream terms of service and applicable laws and regulations.
> - When providing generative AI services to the public, users should comply with applicable regulatory requirements and fulfill all filing, licensing, content safety, real-name verification, log retention, tax, and upstream authorization obligations required by their jurisdiction.

---

## 🔀 About This Fork

This repository is a secondary-development fork of [QuantumNous/new-api](https://github.com/QuantumNous/new-api) (upstream). The fork tracks upstream `main` and adds its own features on top of it. All upstream features, interfaces, and deployment methods remain unchanged — for the complete upstream documentation, see [docs.newapi.pro](https://docs.newapi.pro/en/docs). This README documents only what this fork itself adds or changes, using the STAR format.

### 📌 Situation

- Upstream wallet quota uses a single per-top-up limit (`MaxQuota`, capped at math.MaxInt32). Operating a gateway with `QuotaPerUnit` set to a high currency-swap value (e.g. 500000), aggregate user balances composed from repeated top-ups, redemptions, and admin adjustments can exceed the int32 per-operation boundary.
- In that state the displayed payable amount for recharges silently computes to 0 (a ~209× MaxInt32 overflow at `QuotaPerUnit=500000`), and quota arithmetic across redemption, admin top-up, and payment settlement paths has no shared aggregate ceiling.

### 🎯 Task

- Restore correct recharge amounts at high `QuotaPerUnit` values without breaking any existing payment flow (Epay, Stripe) or unit test contract.
- Introduce a hard aggregate wallet ceiling that no credit path (payment, redemption, admin grant) can exceed, fail closed on overflow, and keep the change compatible with SQLite / MySQL / PostgreSQL.

### 🛠️ Action

- Split-domain wallet capacity: keep the int32 per-top-up limit (`MaxQuota`) and add a new int64 aggregate ceiling `MaxWalletQuota` ($2,000,000 equivalent), with central conversion/quota helpers in `common/quota_math.go`.
- Guard every credit path against the ceiling: payment settlement uses atomic conditional updates (reject uncreditable orders before payment, guard wallet quota during recharge), redemption codes and admin `add_quota` operations verify headroom and fail closed instead of wrapping.
- Relocate Epay price / minimum top-up settings into the Epay settings tab (they previously appeared as generic settings but only affected Epay).
- Fork-wide infrastructure carried alongside: one-click self-update (GitHub-release binary download with checksum verification and atomic replace, Docker pull-and-recreate, Docker Compose image sync on release updates, root-only update APIs + UI), server-side registration invite modes (optional/required/hidden), minimum GitHub account age for OAuth, and CI release workflows that build from exact tags.

### 📈 Result

- Recharge payable amounts compute correctly at `QuotaPerUnit=500000`; the previous silent 0-amount bug is fixed by construction (no credit can push the aggregate wallet past `MaxWalletQuota`).
- All credit paths are overflow-proof and race-safe: concurrent redemption of the same code credits exactly once, orders that cannot be credited are rejected before payment, and settlement is atomic.
- Released as [`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13) (merge commit `ea0ba918`); self-update and invite-mode features shipped in earlier `-th.x` releases.

### 🆚 Quick Comparison

| Area | Upstream (QuantumNous/new-api) | This Fork |
|---|---|---|
| Wallet capacity | Per-top-up int32 limit only | Per-top-up int32 + int64 aggregate ceiling ($2,000,000) |
| Overflow behavior at high QuotaPerUnit | Payable amount can silently compute to 0 | Fail-closed guards; amounts compute correctly |
| Redemption / admin quota credit | No shared aggregate ceiling | Atomic conditional updates with wallet headroom check |
| Epay price / min top-up settings | Listed as generic settings | Scoped to the Epay settings tab |
| Self-update | Manual image pull / upgrade | One-click self-update (binary checksum + atomic replace, Docker recreate, Compose sync) |
| Registration invites | Single global toggle | Server-authoritative modes: optional / required / hidden |
| Release versioning | Upstream tags | `v{upstream}-th.{x}` fork release line |

### 🏷️ Fork Releases

The fork publishes its own release line `v{upstream}-th.{x}` on the [Releases page](https://github.com/ChinaToyHunter/new-api/releases). Current release: [`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13).

---

## 📜 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

Additional terms under AGPLv3 Section 7 apply. Modified versions must preserve
the author attribution notice `Frontend design and development by New API
contributors.` in the appropriate legal notices and in any prominent about,
legal, footer, or attribution location presented by the user interface.

Modified versions that present a user interface must also preserve a visible
link to the original project: <https://github.com/QuantumNous/new-api>.

This is an open-source project developed based on [One API](https://github.com/songquanpeng/one-api) (MIT License).

If your organization's policies do not permit the use of AGPLv3-licensed software, or if you wish to avoid the open-source obligations of AGPLv3, please contact us at: [support@quantumnous.com](mailto:support@quantumnous.com)

---

## 🌟 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=QuantumNous/new-api,ChinaToyHunter/new-api&type=Date)](https://star-history.com/#QuantumNous/new-api&ChinaToyHunter/new-api&Date)

</div>

If you find this fork useful, please consider starring ⭐️ [ChinaToyHunter/new-api](https://github.com/ChinaToyHunter/new-api) — and if you use upstream directly, star [QuantumNous/new-api](https://github.com/QuantumNous/new-api) too.

---

<div align="center">

### 💖 Thank you for using New API

<sub>Built with ❤️ by QuantumNous</sub>

<sub>Fork maintained by <a href="https://github.com/ChinaToyHunter">ChinaToyHunter</a></sub>

</div>
