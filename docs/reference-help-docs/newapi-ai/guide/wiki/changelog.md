# 更新日志

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/wiki/changelog.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/wiki/changelog.mdx

## 页面大纲

  - v1.0.0-rc.5
    - Highlights
    - New Features
    - Bug Fixes
    - Improvements
    - What's Changed
    - New Contributors
  - v1.0.0-rc.4
    - Highlights
    - New Features
    - Bug Fixes
    - Breaking Changes
    - Gallery
    - What's Changed
  - v1.0.0-rc.3
    - Highlights
    - New Features
    - Improvements
    - Bug Fixes
    - Gallery
    - What's Changed
  - v1.0.0-rc.2
    - Highlights
    - New Features
    - Improvements
    - Bug Fixes
    - Gallery
    - What's Changed
    - New Contributors
  - v1.0.0-rc.1
    - New Features
    - Improvements
    - Bug Fixes
    - What's Changed
    - New Contributors
  - v1.0.0-alpha.1  - License boundary release
  - v0.13.2
    - New Features
    - Bug Fixes
    - Improvements
    - What's Changed
  - v0.13.1-patch.1
    - Highlights
    - New Features
  - v0.13.1
      - New Features
      - Bug Fixes
    - What's Changed
  - v0.13.0
    - Highlights
    - New Features
    - Bug Fixes
    - Improvements
    - What's Changed
    - New Contributors
  - v0.12.15
      - New Features
      - Bug Fixes
      - Improvements
    - What's Changed
    - New Contributors
  - v0.12.14
    - Improvements
  - v0.12.13
      - Bug Fixes
      - Improvements
      - Breaking Changes
  - v0.12.12
    - New Features
    - What's Changed
  - v0.12.11
      - New Features
      - Bug Fixes
  - v0.12.10
    - New Features
    - Bug Fixes
    - Improvements
    - What's Changed
    - New Contributors
  - v0.12.9
    - New Features
    - Bug Fixes
    - Improvements
    - What's Changed
    - New Contributors
  - v0.12.8
      - Bug Fixes
    - What's Changed
  - v0.12.7
    - Improvements
  - v0.12.6
      - New Features
      - Bug Fixes
      - Improvements
    - What's Changed
    - New Contributors
  - nightly-20260409-4d2993e
      - Highlights / 重点更新
      - New Features
      - Bug Fixes
      - Improvements
    - What's Changed
    - New Contributors
  - v0.12.5
      - New Features
      - Improvements
      - Bug Fixes
    - What's Changed
    - New Contributors
  - v0.12.4
    - New Features
    - Bug Fixes
    - Improvements
    - What's Changed
    - New Contributors
  - v0.12.3
    - Improvements
    - What's Changed
  - v0.12.2
      - New Features
      - Bug Fixes
      - Improvements
    - What's Changed
    - New Contributors
  - v0.12.1
    - New Features
    - Improvements
    - What's Changed
  - v0.12.0
    - New Features
    - Bug Fixes
    - Improvements
    - What's Changed
    - New Contributors
  - v0.12.0-alpha.2
    - Release Highlights
    - Bug Fixes
  - v0.12.0-alpha.1
    - Highlights
    - New Features
    - Bug Fixes
    - Improvements
    - What's Changed
    - New Contributors
  - v0.11.9
    - Release Notes for v0.11.9
      - New Features
      - Bug Fixes
      - Improvements
    - What's Changed

## 原文内容

---
title: 更新日志
---
import { Callout } from 'fumadocs-ui/components/callout';

<Callout type="warn" title="版本日志信息 · 数据更新于 2026-5-12 19:21:58">
如需查看全部历史版本，请访问 [GitHub Releases 页面](https://github.com/QuantumNous/new-api/releases)，本页面从该页面定时获取最新更新信息。
</Callout>

## v1.0.0-rc.5

<Callout type="info" title="最新正式版本 · 发布于 2026-05-12 16:53:57 (中国时间)">

### Highlights
The default dashboard has been refreshed with built-in model performance metrics and a clearer health view. This release also adds DeepChat deeplink support and fixes several default UI, wallet, playground, and ratio-display regressions.

### New Features
- Dashboard overview has been redesigned and now includes model performance metrics with a clearer performance health panel.
- DeepChat deeplinks are now supported, making it easier to open supported chat links directly in DeepChat. (#4668)

### Bug Fixes
- Top-up gateway availability now uses the correct top-up configuration, so wallet payment options are shown accurately. (#4599)
- Group ratio displays now honor configured group-to-group ratio settings. (#4772)
- Default UI dropdown menu items now trigger their selection handlers reliably. (#4787)
- The playground now handles legacy classic-format messages without failing. (#4650)
- Default frontend pages now avoid several v1 UI regressions, including stray empty description areas and layout issues. (#4802)

### Improvements
- The default web UI and charts now follow shared theme presets for more consistent colors, controls, and corner radii.
- Docker images now include project and third-party license notices for easier compliance review. (#4739)

---

### What's Changed
* feat: add DeepChat deeplink support by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4668
* fix: exclude THIRD-PARTY-LICENSES.md from .dockerignore for Docker build by @yeying-xingchen in https://github.com/QuantumNous/new-api/pull/4739
* fix(wallet): read topup gateway flags from topupInfo instead of status by @ImogeneOctaviap794 in https://github.com/QuantumNous/new-api/pull/4599
* fix(web/default): use getUserGroups for ratio display to respect GroupGroupRatio by @Micah-Zheng in https://github.com/QuantumNous/new-api/pull/4772
* fix(default): support DropdownMenuItem onSelect by @lihan3238 in https://github.com/QuantumNous/new-api/pull/4787
* fix(web/default): guard playground messages against legacy classic shape by @feitianbubu in https://github.com/QuantumNous/new-api/pull/4650
* fix: defaut ui triage by @Calcium-Ion in https://github.com/QuantumNous/new-api/pull/4802

### New Contributors
* @yeying-xingchen made their first contribution in https://github.com/QuantumNous/new-api/pull/4739
* @lihan3238 made their first contribution in https://github.com/QuantumNous/new-api/pull/4787

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v1.0.0-rc.4...v1.0.0-rc.5

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.5/checksums-linux.txt">checksums-linux.txt</a> (178 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.5/checksums-windows.txt">checksums-windows.txt</a> (90 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.5/new-api-arm64-v1.0.0-rc.5">new-api-arm64-v1.0.0-rc.5</a> (82.1 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.5/new-api-v1.0.0-rc.5">new-api-v1.0.0-rc.5</a> (84.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.5/new-api-v1.0.0-rc.5.exe">new-api-v1.0.0-rc.5.exe</a> (86.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.5.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.5.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v1.0.0-rc.4

<Callout type="note" title="正式版本 · 发布于 2026-05-06 22:25:59 (中国时间)">

### Highlights
OpenAI image editing is more reliable: image edit requests now preserve reference image data and related metadata, preventing edits from losing their intended context (#4646). This release also adds model performance badges and fixes several billing and dropdown UI issues.

### New Features
- Added model performance badges to model lists so users can compare available models at a glance.

### Bug Fixes
- Fixed OpenAI image edit requests so reference images and related edit metadata are preserved when forwarded (#4646).
- Fixed billing settings forms so top-up and billing configuration inputs behave more reliably.
- Fixed dropdown and select controls so options render and select correctly after the UI component update (#4655).

### Breaking Changes
- Integrations should now read the top-up link from the top-up information API instead of the status API.

### Gallery
| Model availability rankings | Refreshed pricing and settings UI |
| --- | --- |
|<img width="3644" height="2160" alt="" src="https://github.com/user-attachments/assets/03e974ba-4605-4bfd-83ef-dd32a30974de" />| <img width="3618" height="2156" alt="" src="https://github.com/user-attachments/assets/db5bb31a-ef40-4914-989f-b7a6fd569a85" />|

---

### What's Changed
* fix: preserve OpenAI image edit reference fields by @seefs001 in https://github.com/QuantumNous/new-api/pull/4646
* fix: migrate select to Base UI items API by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4655


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v1.0.0-rc.3...v1.0.0-rc.4

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.4/checksums-linux.txt">checksums-linux.txt</a> (178 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.4/checksums-windows.txt">checksums-windows.txt</a> (90 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.4/new-api-arm64-v1.0.0-rc.4">new-api-arm64-v1.0.0-rc.4</a> (82.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.4/new-api-v1.0.0-rc.4">new-api-v1.0.0-rc.4</a> (84.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.4/new-api-v1.0.0-rc.4.exe">new-api-v1.0.0-rc.4.exe</a> (86.1 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.4.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.4.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v1.0.0-rc.3

<Callout type="note" title="正式版本 · 发布于 2026-05-06 18:43:33 (中国时间)">

### Highlights
v1.0.0-rc.3 adds a new model rankings experience with model availability and performance visibility, making it easier to compare reliability before choosing routes or providers. This release also refreshes key default UI areas, including pricing/settings pages and table controls.

### New Features
- Added a model rankings dashboard with real availability and performance data so users can compare model reliability at a glance (#4633).

### Improvements
- Refreshed the default web UI with Base UI components, updated theme presets, and cleaner table toolbar interactions (#4633).
- Reorganized the system settings pricing interface to make pricing configuration easier to scan and manage.

### Bug Fixes
- Fixed channel table sorting so server-side sorting now works correctly (#4600).
- Corrected subscription payment information display in the default UI.

### Gallery
| Model availability rankings | Refreshed pricing and settings UI |
| --- | --- |
|<img width="3644" height="2160" alt="" src="https://github.com/user-attachments/assets/03e974ba-4605-4bfd-83ef-dd32a30974de" />| <img width="3618" height="2156" alt="" src="https://github.com/user-attachments/assets/db5bb31a-ef40-4914-989f-b7a6fd569a85" />|

---

### What's Changed
* feat(web/default): unified UI overhaul — Base UI migration, theme presets, rankings dashboard, and table toolbar refactor by @Calcium-Ion in https://github.com/QuantumNous/new-api/pull/4633
* feat: collect model performance metrics by @Calcium-Ion in https://github.com/QuantumNous/new-api/pull/4635
* fix: enable channel table server-side sorting by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4600


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v1.0.0-rc.2...v1.0.0-rc.3

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.3/checksums-linux.txt">checksums-linux.txt</a> (178 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.3/checksums-windows.txt">checksums-windows.txt</a> (90 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.3/new-api-arm64-v1.0.0-rc.3">new-api-arm64-v1.0.0-rc.3</a> (81.9 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.3/new-api-v1.0.0-rc.3">new-api-v1.0.0-rc.3</a> (84.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.3/new-api-v1.0.0-rc.3.exe">new-api-v1.0.0-rc.3.exe</a> (86.1 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.3.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.3.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v1.0.0-rc.2

<Callout type="note" title="正式版本 · 发布于 2026-04-30 20:42:48 (中国时间)">

### Highlights
v1.0.0-rc.2 officially opens up switching between the new and classic frontend, making it easier to test the redesigned UI, compare workflows, and fall back instantly when needed. This RC also refreshes key console pages and fixes several web issues affecting email binding, tiered pricing, API key grouping, and custom Vertex base URLs.

### New Features
- Added a built-in switch between the new and classic frontend, so teams can adopt the redesigned UI gradually without losing access to the previous workflow.

### Improvements
- Refreshed the web console with redesigned pricing pages, more consistent dashboard and log controls, better table and analytics filtering, smoother navigation, and improved mobile responsiveness.

### Bug Fixes
- Fixed email binding in the redesigned frontend so the action completes correctly (#4551).
- Fixed tiered pricing number input behavior so editing values is more reliable (#4536).
- Fixed tiered pricing display issues that could cause values and labels to appear incorrectly (#4530).
- Fixed API key grouping in the default web theme so keys appear under the expected groups (#4548).
- Fixed custom Vertex base URLs so requests route correctly when a gateway prefix is configured (#4200).

### Gallery

| Refreshed pricing page | Dashboard and analytics controls |
| --- | --- |
| <img width="100%" alt="Refreshed pricing page" src="https://github.com/user-attachments/assets/8d403155-27ac-407d-b0ae-8815034c66a7" /> | <img width="100%" alt="Dashboard and analytics controls" src="https://github.com/user-attachments/assets/caa73f0a-13d2-47fc-ab7d-0ffb4e7b6194" /> |

### What's Changed
* fix: 修复默认主题 API 密钥分组行为 by @Micah-Zheng in https://github.com/QuantumNous/new-api/pull/4548
* bug fix: 新版前端email绑定错误 by @SHLE1 in https://github.com/QuantumNous/new-api/pull/4551
* fix: improve tiered pricing number input editing by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4536
* fix(vertex): honor custom base_url as gateway prefix by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4200
* fix(web): 修复阶梯计费 Base64 解码失败与标签不匹配导致的显示错误 by @wans10 in https://github.com/QuantumNous/new-api/pull/4530

### New Contributors
* @SHLE1 made their first contribution in https://github.com/QuantumNous/new-api/pull/4551

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v1.0.0-rc.1...v1.0.0-rc.2

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.2/checksums-linux.txt">checksums-linux.txt</a> (178 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.2/checksums-windows.txt">checksums-windows.txt</a> (90 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.2/new-api-arm64-v1.0.0-rc.2">new-api-arm64-v1.0.0-rc.2</a> (76.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.2/new-api-v1.0.0-rc.2">new-api-v1.0.0-rc.2</a> (78.9 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.2/new-api-v1.0.0-rc.2.exe">new-api-v1.0.0-rc.2.exe</a> (80.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.2.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.2.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v1.0.0-rc.1

<Callout type="note" title="正式版本 · 发布于 2026-04-29 20:15:01 (中国时间)">

v1.0.0-rc.1 is the first release candidate for the upcoming 1.0 release, and its main focus is the brand-new v1 frontend rebuilt from the ground up for a cleaner, faster, and more capable admin experience.

This RC refreshes the interface across navigation, configuration, analytics, and logs, making day-to-day management much easier as the project moves toward the final v1 launch.

<img width="3544" height="2166" alt="" src="https://github.com/user-attachments/assets/f3f8ed32-e0c5-4cfb-94a3-da0f357b62ab" />

### New Features
- Introduced the rebuilt v1 frontend with modern navigation and layouts, a visual channel editor for parameter overrides, and easier access to system settings and theme switching (#4265).

### Improvements
- Upgraded dashboards and charts with clearer model analytics, better data sorting, and more informative tooltips for easier usage analysis.
- Improved usage logs with log type indicators, usernames and avatars, and cleaner tables that make activity easier to scan.
- Polished shared layouts, tables, and form styling across the default frontend for a cleaner and more consistent experience.

### Bug Fixes
- Fixed themes loaded from the database so the selected frontend theme now applies correctly at runtime (#4518).
- Fixed forwarded requests so empty reasoning fields are preserved instead of being silently dropped (#4520).
- Fixed required-field markers so forms more consistently show which inputs are mandatory (#4533).

---

### What's Changed
* 🚀 feat: launch v1.0 — next-generation frontend built from the ground up by @t0ng7u in https://github.com/QuantumNous/new-api/pull/4265
* fix: 修复 Message.ReasoningContent/Reasoning 空思考内容在请求转发时被静默丢弃 by @heimoshuiyu in https://github.com/QuantumNous/new-api/pull/4520
* fix: sync theme to runtime when loaded from database by @Micah-Zheng in https://github.com/QuantumNous/new-api/pull/4518

### New Contributors
* @Micah-Zheng made their first contribution in https://github.com/QuantumNous/new-api/pull/4518

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v1.0.0-alpha.1...v1.0.0-rc.1

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.1/checksums-linux.txt">checksums-linux.txt</a> (178 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.1/checksums-windows.txt">checksums-windows.txt</a> (90 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.1/new-api-arm64-v1.0.0-rc.1">new-api-arm64-v1.0.0-rc.1</a> (76.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.1/new-api-v1.0.0-rc.1">new-api-v1.0.0-rc.1</a> (78.8 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v1.0.0-rc.1/new-api-v1.0.0-rc.1.exe">new-api-v1.0.0-rc.1.exe</a> (80.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.1.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-rc.1.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v1.0.0-alpha.1  - License boundary release

<Callout type="note" title="预发布版本 · 发布于 2026-04-28 14:26:06 (中国时间)">

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.13.2...v1.0.0-alpha.1

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-alpha.1.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v1.0.0-alpha.1.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.13.2

<Callout type="note" title="正式版本 · 发布于 2026-04-27 22:11:42 (中国时间)">

### New Features
- Model sync now detects upstream models more accurately, refreshes pricing automatically from provider pricing endpoints, shows removed upstream models in the fetch-models dialog, and keeps pricing available during sync delays (#4452).
- User records now include account creation and last login timestamps for easier auditing and administration (#4450).
- Added configurable model matching for Ali native Messages APIs, making it easier to route requests to compatible upstream models (#4468).

### Bug Fixes
- Tool calls now accept raw JSON argument payloads, improving compatibility with providers that return tool arguments as JSON objects (#4469).
- Configuration updates now handle JSON object fields more reliably, preventing some settings from being saved incorrectly.

### Improvements
- Retry messages now clearly explain when a channel was skipped because affinity is disabled (#4453).

---

### What's Changed
* fix(channel): load model mapping during upstream model checks by @seefs001 in https://github.com/QuantumNous/new-api/pull/4437
* feat: sync upstream pricing from pricing endpoint by @seefs001 in https://github.com/QuantumNous/new-api/pull/4452
* fix: clarify affinity disabled channel retry message by @seefs001 in https://github.com/QuantumNous/new-api/pull/4453
* feat: configure native messages model matching for ali by @seefs001 in https://github.com/QuantumNous/new-api/pull/4468
* fix: support raw JSON response tool arguments by @seefs001 in https://github.com/QuantumNous/new-api/pull/4469
* feat: show removed upstream models in fetch models modal by @seefs001 in https://github.com/QuantumNous/new-api/pull/4470
* 增加用户创建时间和最后登录时间 by @feitianbubu in https://github.com/QuantumNous/new-api/pull/4450


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.13.1-patch.1...v0.13.2

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/New-API-App.0.13.2.exe">New-API-App.0.13.2.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/New-API-App.Setup.0.13.2.exe">New-API-App.Setup.0.13.2.exe</a> (106.8 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/new-api-arm64-v0.13.2">new-api-arm64-v0.13.2</a> (64.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/new-api-macos-v0.13.2">new-api-macos-v0.13.2</a> (83.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/new-api-v0.13.2">new-api-v0.13.2</a> (67.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.2/new-api-v0.13.2.exe">new-api-v0.13.2.exe</a> (68.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.13.2.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.13.2.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.13.1-patch.1

<Callout type="note" title="正式版本 · 发布于 2026-04-25 13:27:23 (中国时间)">

### Highlights
This patch adds support for using `len` in tier conditions and the LLM prompt helper, making it easier to build rules based on prompt length.

### New Features
- Added a `len` variable to tier conditions and the LLM prompt helper so you can define rules based on prompt length.

---

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.13.1...v0.13.1-patch.1

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1-patch.1/checksums-linux.txt">checksums-linux.txt</a> (186 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1-patch.1/checksums-macos.txt">checksums-macos.txt</a> (96 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1-patch.1/checksums-windows.txt">checksums-windows.txt</a> (94 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1-patch.1/new-api-arm64-v0.13.1-patch.1">new-api-arm64-v0.13.1-patch.1</a> (64.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1-patch.1/new-api-macos-v0.13.1-patch.1">new-api-macos-v0.13.1-patch.1</a> (83.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1-patch.1/new-api-v0.13.1-patch.1">new-api-v0.13.1-patch.1</a> (66.9 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1-patch.1/new-api-v0.13.1-patch.1.exe">new-api-v0.13.1-patch.1.exe</a> (68.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.13.1-patch.1.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.13.1-patch.1.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.13.1

<Callout type="note" title="正式版本 · 发布于 2026-04-24 22:20:58 (中国时间)">

#### New Features
* Added support for handling DeepSeek V4 reasoning suffixes (#4428)

#### Bug Fixes
* Fixed an issue where tiered billing models were excluded from the model listing (#4431)

---

### What's Changed
* fix: include tiered billing models in model listing by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4431
* feat: implement DeepSeek V4 reasoning suffix handling and tests by @HynoR in https://github.com/QuantumNous/new-api/pull/4428


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.13.0...v0.13.1

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/New-API-App.0.13.1.exe">New-API-App.0.13.1.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/New-API-App.Setup.0.13.1.exe">New-API-App.Setup.0.13.1.exe</a> (106.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/new-api-arm64-v0.13.1">new-api-arm64-v0.13.1</a> (64.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/new-api-macos-v0.13.1">new-api-macos-v0.13.1</a> (83.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/new-api-v0.13.1">new-api-v0.13.1</a> (66.9 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.1/new-api-v0.13.1.exe">new-api-v0.13.1.exe</a> (68.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.13.1.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.13.1.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.13.0

<Callout type="note" title="正式版本 · 发布于 2026-04-24 14:09:21 (中国时间)">

### Highlights
This release introduces powerful support for `expr` expression-based tiered billing, allowing administrators to configure complex, dynamic pricing rules. A simple use case for this feature is a pricing expression like `tokens <= 128000 ? 0.002 : 0.004`, where the system will automatically apply a lower rate for usage under 128K tokens and a higher rate for anything above that threshold.

### New Features
* Introduces support for evaluating `expr` expressions in the billing system, enabling dynamic tiered pricing with configurable presets (#4409).
* Adds a UI for tool pricing settings and improves tool call quota calculations.
* Displays the user ID in admin top-up bills for easier tracking (#4349).
* Adds a 'last used time' column to the tokens table (#4372).
* Relaxes token key column length requirements to support the migration of longer legacy token keys (#4401).

### Bug Fixes
* Ensures the pricing calculation logic only applies the N ratio to image models (#4412).
* Preserves text tool surcharges properly during tiered billing settlement (#4162).
* Corrects the completion ratio configuration for the `gpt-5.5` model (#4414).
* Fixes the model pricing UI to use the correct display type (#4426).
* Resolves runtime crashes and edge cases within the tiered pricing editor and settlement logic.
* Updates channel testing to properly support and evaluate tiered billing models.

### Improvements
* Adds preset pricing tiers for Doubao Seed 1.8 to enhance discount calculations.
* Replaces Card components with divs to improve overall layout consistency.
* Updates internal billing calculations to use quota per unit for better accuracy.

---

### What's Changed
* fix(channel-test): support tiered billing model tests by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4145
* 在管理员充值账单中显示用户 ID by @uskyu in https://github.com/QuantumNous/new-api/pull/4349
* 增加令牌最后使用时间 by @feitianbubu in https://github.com/QuantumNous/new-api/pull/4372
* chore(deps): bump github.com/jackc/pgx/v5 from 5.9.0 to 5.9.2 by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/4397
* chore(deps-dev): bump @xmldom/xmldom from 0.8.12 to 0.8.13 in /electron by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/4399
* Relax token key column length for legacy migration compatibility by @XiaoAI1024 in https://github.com/QuantumNous/new-api/pull/4401
* fix(billing): preserve text tool surcharges in tiered settlement by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4162
* feat: support for tiered billing expressions in the billing system by @Calcium-Ion in https://github.com/QuantumNous/new-api/pull/4409
* fix(image): only price image model use N ratio by @xyfacai in https://github.com/QuantumNous/new-api/pull/4412
* fix: correct gpt-5.5 completion ratio by @jingx8885 in https://github.com/QuantumNous/new-api/pull/4414
* fix: model pricing use correct display type by @feitianbubu in https://github.com/QuantumNous/new-api/pull/4426

### New Contributors
* @uskyu made their first contribution in https://github.com/QuantumNous/new-api/pull/4349
* @XiaoAI1024 made their first contribution in https://github.com/QuantumNous/new-api/pull/4401
* @jingx8885 made their first contribution in https://github.com/QuantumNous/new-api/pull/4414

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.15...v0.13.0

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/New-API-App.0.13.0.exe">New-API-App.0.13.0.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/New-API-App.Setup.0.13.0.exe">New-API-App.Setup.0.13.0.exe</a> (106.8 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/new-api-arm64-v0.13.0">new-api-arm64-v0.13.0</a> (64.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/new-api-macos-v0.13.0">new-api-macos-v0.13.0</a> (83.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/new-api-v0.13.0">new-api-v0.13.0</a> (66.9 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.13.0/new-api-v0.13.0.exe">new-api-v0.13.0.exe</a> (68.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.13.0.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.13.0.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.15

<Callout type="note" title="正式版本 · 发布于 2026-04-22 23:04:03 (中国时间)">

#### New Features
- Added Waffo Pay support for account top-ups and payment workflows (#4089).

#### Bug Fixes
- Fixed a recharge card issue in the top-up flow that could break parts of the card interface (#4388).

#### Improvements
- Added support for Gemini's `IncludeServerSideToolInvocations` setting in `ToolConfig`, improving compatibility with newer Gemini tool-calling behavior (#4311).
- Improved Codex channel reliability and usability by refreshing credentials for auto-disabled channels, using streaming for automatic tests, and refining the usage modal (#4324).

---

### What's Changed
* fix(gemini): add IncludeServerSideToolInvocations field to ToolConfig by @KoellM in https://github.com/QuantumNous/new-api/pull/4311
* rafactor: payment by @seefs001 in https://github.com/QuantumNous/new-api/pull/4089
* fix(topup): import missing Tag in recharge card by @gaoren002 in https://github.com/QuantumNous/new-api/pull/4388
* chore: refine codex usage modal layout by @seefs001 in https://github.com/QuantumNous/new-api/pull/4386
* fix: use stream for codex auto test by @seefs001 in https://github.com/QuantumNous/new-api/pull/4325
* fix: refresh codex credentials for auto-disabled channels by @seefs001 in https://github.com/QuantumNous/new-api/pull/4324
* fix: require proper verification for passkey changes by @seefs001 in https://github.com/QuantumNous/new-api/pull/4393

### New Contributors
* @KoellM made their first contribution in https://github.com/QuantumNous/new-api/pull/4311
* @gaoren002 made their first contribution in https://github.com/QuantumNous/new-api/pull/4388

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.14...v0.12.15

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/checksums-linux.txt">checksums-linux.txt</a> (172 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/checksums-macos.txt">checksums-macos.txt</a> (89 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/checksums-windows.txt">checksums-windows.txt</a> (87 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/New-API-App.0.12.15.exe">New-API-App.0.12.15.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/New-API-App.Setup.0.12.15.exe">New-API-App.Setup.0.12.15.exe</a> (106.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/new-api-arm64-v0.12.15">new-api-arm64-v0.12.15</a> (63.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/new-api-macos-v0.12.15">new-api-macos-v0.12.15</a> (82.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/new-api-v0.12.15">new-api-v0.12.15</a> (66.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.15/new-api-v0.12.15.exe">new-api-v0.12.15.exe</a> (67.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.15.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.15.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.14

<Callout type="note" title="正式版本 · 发布于 2026-04-18 00:41:21 (中国时间)">

### Improvements
- Improved user-visible management and top-up logs with a cleaner display, preserved row expansion, and clearer handling of legacy records.

---

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.13...v0.12.14

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/checksums-linux.txt">checksums-linux.txt</a> (172 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/checksums-macos.txt">checksums-macos.txt</a> (89 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/checksums-windows.txt">checksums-windows.txt</a> (87 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/New-API-App.0.12.14.exe">New-API-App.0.12.14.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/New-API-App.Setup.0.12.14.exe">New-API-App.Setup.0.12.14.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/new-api-arm64-v0.12.14">new-api-arm64-v0.12.14</a> (63.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/new-api-macos-v0.12.14">new-api-macos-v0.12.14</a> (81.9 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/new-api-v0.12.14">new-api-v0.12.14</a> (66.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.14/new-api-v0.12.14.exe">new-api-v0.12.14.exe</a> (67.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.14.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.14.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.13

<Callout type="note" title="正式版本 · 发布于 2026-04-18 00:04:31 (中国时间)">

This release improves admin workflows for top-ups and makes account status changes apply more consistently.

#### Bug Fixes
- Disabling a user now takes effect immediately instead of being delayed by stale cached account data.

#### Improvements
- Top-up logs now include additional admin-only audit details to make review and troubleshooting easier.

#### Breaking Changes
- Top-up searches are now limited to a maximum 30-day date range to keep queries responsive and reliable.

---

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.12...v0.12.13

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/checksums-linux.txt">checksums-linux.txt</a> (172 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/checksums-macos.txt">checksums-macos.txt</a> (89 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/checksums-windows.txt">checksums-windows.txt</a> (87 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/New-API-App.0.12.13.exe">New-API-App.0.12.13.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/New-API-App.Setup.0.12.13.exe">New-API-App.Setup.0.12.13.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/new-api-arm64-v0.12.13">new-api-arm64-v0.12.13</a> (63.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/new-api-macos-v0.12.13">new-api-macos-v0.12.13</a> (81.9 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/new-api-v0.12.13">new-api-v0.12.13</a> (66.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.13/new-api-v0.12.13.exe">new-api-v0.12.13.exe</a> (67.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.13.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.13.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.12

<Callout type="note" title="正式版本 · 发布于 2026-04-17 14:05:08 (中国时间)">

This release adds support for Claude Opus 4.7, expanding the set of available models in the API.

### New Features
- Added support for the Claude Opus 4.7 model, making it available through the API alongside existing model options (#4293).

---

### What's Changed
* feat: support claude-opus-4-7 by @prnake in https://github.com/QuantumNous/new-api/pull/4293
* chore(deps): bump github.com/jackc/pgx/v5 from 5.7.1 to 5.9.0 by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/4294


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.11...v0.12.12

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/checksums-linux.txt">checksums-linux.txt</a> (172 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/checksums-macos.txt">checksums-macos.txt</a> (89 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/checksums-windows.txt">checksums-windows.txt</a> (87 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/New-API-App.0.12.12.exe">New-API-App.0.12.12.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/New-API-App.Setup.0.12.12.exe">New-API-App.Setup.0.12.12.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/new-api-arm64-v0.12.12">new-api-arm64-v0.12.12</a> (63.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/new-api-macos-v0.12.12">new-api-macos-v0.12.12</a> (81.8 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/new-api-v0.12.12">new-api-v0.12.12</a> (65.9 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.12/new-api-v0.12.12.exe">new-api-v0.12.12.exe</a> (67.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.12.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.12.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.11

<Callout type="note" title="正式版本 · 发布于 2026-04-16 20:13:49 (中国时间)">

#### New Features
* Added payment method tracking and validation for top-ups.

#### Bug Fixes
* Improved handling of empty string content during OpenAI to Claude message conversion.

---

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.10...v0.12.11

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/checksums-linux.txt">checksums-linux.txt</a> (172 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/checksums-macos.txt">checksums-macos.txt</a> (89 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/checksums-windows.txt">checksums-windows.txt</a> (87 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/New-API-App.0.12.11.exe">New-API-App.0.12.11.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/New-API-App.Setup.0.12.11.exe">New-API-App.Setup.0.12.11.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/new-api-arm64-v0.12.11">new-api-arm64-v0.12.11</a> (63.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/new-api-macos-v0.12.11">new-api-macos-v0.12.11</a> (81.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/new-api-v0.12.11">new-api-v0.12.11</a> (65.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.11/new-api-v0.12.11.exe">new-api-v0.12.11.exe</a> (67.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.11.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.11.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.10

<Callout type="note" title="正式版本 · 发布于 2026-04-15 21:02:01 (中国时间)">

### New Features
- Added passthrough support for Claude `cache_control` and `speed` options, giving you more control over request behavior when using Claude models (#4247).

### Bug Fixes
- Fixed OpenAI Responses API compatibility issues when `instructions` contain structured content instead of plain text (#4260).

### Improvements
- Improved Stripe payment processing to better handle asynchronous webhook events, making delayed payment confirmations more reliable.
- Quota adjustment logs now record the acting admin username, making administrative audit trails easier to follow (#4216).

---

### What's Changed
* fix: use json.RawMessage for Instructions field in OpenAIResponsesResponse by @linbin524 in https://github.com/QuantumNous/new-api/pull/4260
* fix(channel): 修复多密钥管理弹窗索引显示，将索引值调整为从1开始 by @wans10 in https://github.com/QuantumNous/new-api/pull/4231
* feat(claude): add cache_control and speed passthrough controls by @seefs001 in https://github.com/QuantumNous/new-api/pull/4247
* feat: include admin username in quota adjustment logs by @feitianbubu in https://github.com/QuantumNous/new-api/pull/4216

### New Contributors
* @linbin524 made their first contribution in https://github.com/QuantumNous/new-api/pull/4260

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.9...v0.12.10

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/checksums-linux.txt">checksums-linux.txt</a> (172 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/checksums-macos.txt">checksums-macos.txt</a> (89 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/checksums-windows.txt">checksums-windows.txt</a> (87 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/New-API-App.0.12.10.exe">New-API-App.0.12.10.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/New-API-App.Setup.0.12.10.exe">New-API-App.Setup.0.12.10.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/new-api-arm64-v0.12.10">new-api-arm64-v0.12.10</a> (63.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/new-api-macos-v0.12.10">new-api-macos-v0.12.10</a> (81.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/new-api-v0.12.10">new-api-v0.12.10</a> (65.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.10/new-api-v0.12.10.exe">new-api-v0.12.10.exe</a> (67.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.10.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.10.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.9

<Callout type="note" title="正式版本 · 发布于 2026-04-13 15:28:47 (中国时间)">

### New Features
- Subscription cards now show the next quota reset time, making it easier to see when usage limits will refresh (#4181).

### Bug Fixes
- Claude requests are now more reliable by avoiding incompatible Top P settings when needed.
- Azure channels now correctly support the `/v1/responses/compact` route (#4149).
- Editing values in GroupTable no longer forces the cursor to jump to the end on each keystroke (#4208).

### Improvements
- Dashboard charts have been refined to present rankings and chart sizing more clearly for easier monitoring.

---

### What's Changed
* fix(GroupTable): prevent Input cursor jumping to end on keystroke by @Xbang0222 in https://github.com/QuantumNous/new-api/pull/4208
* feat: display next quota reset time in subscription card by @ShengM97 in https://github.com/QuantumNous/new-api/pull/4181
* fix: add Azure channel support for /v1/responses/compact URL routing by @woan1136 in https://github.com/QuantumNous/new-api/pull/4149

### New Contributors
* @Xbang0222 made their first contribution in https://github.com/QuantumNous/new-api/pull/4208
* @ShengM97 made their first contribution in https://github.com/QuantumNous/new-api/pull/4181
* @woan1136 made their first contribution in https://github.com/QuantumNous/new-api/pull/4149

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.8...v0.12.9

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/New-API-App.0.12.9.exe">New-API-App.0.12.9.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/New-API-App.Setup.0.12.9.exe">New-API-App.Setup.0.12.9.exe</a> (106.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/new-api-arm64-v0.12.9">new-api-arm64-v0.12.9</a> (63.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/new-api-macos-v0.12.9">new-api-macos-v0.12.9</a> (81.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/new-api-v0.12.9">new-api-v0.12.9</a> (65.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.9/new-api-v0.12.9.exe">new-api-v0.12.9.exe</a> (67.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.9.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.9.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.8

<Callout type="note" title="正式版本 · 发布于 2026-04-12 23:58:29 (中国时间)">

#### Bug Fixes
* Correctly report the stream status in error logs instead of defaulting to false (#4195).

---

### What's Changed
* fix: isStream status in error logs instead of hardcoded false by @feitianbubu in https://github.com/QuantumNous/new-api/pull/4195
* chore(deps): bump axios from 1.13.5 to 1.15.0 in /web by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/4201


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.7...v0.12.8

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/New-API-App.0.12.8.exe">New-API-App.0.12.8.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/New-API-App.Setup.0.12.8.exe">New-API-App.Setup.0.12.8.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/new-api-arm64-v0.12.8">new-api-arm64-v0.12.8</a> (63.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/new-api-macos-v0.12.8">new-api-macos-v0.12.8</a> (81.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/new-api-v0.12.8">new-api-v0.12.8</a> (65.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.8/new-api-v0.12.8.exe">new-api-v0.12.8.exe</a> (67.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.8.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.8.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.7

<Callout type="note" title="正式版本 · 发布于 2026-04-12 17:47:25 (中国时间)">

### Improvements
- Quota management now uses an amount-first input flow and applies changes atomically, making balance adjustments simpler and more reliable.
- Model pricing errors now use cleaner, role-aware messages so it is easier to understand and resolve failed pricing actions.

---

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.6...v0.12.7

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/New-API-App.0.12.7.exe">New-API-App.0.12.7.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/New-API-App.Setup.0.12.7.exe">New-API-App.Setup.0.12.7.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/new-api-arm64-v0.12.7">new-api-arm64-v0.12.7</a> (63.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/new-api-macos-v0.12.7">new-api-macos-v0.12.7</a> (81.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/new-api-v0.12.7">new-api-v0.12.7</a> (65.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.7/new-api-v0.12.7.exe">new-api-v0.12.7.exe</a> (67.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.7.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.7.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.6

<Callout type="note" title="正式版本 · 发布于 2026-04-09 14:44:42 (中国时间)">

#### New Features
* Fill in custom fields for vllm-omini (#4154)

#### Bug Fixes
* Accept string usage values in Alibaba task polling (#4155)
* Use correct endpoint for coding plan image generation in Zhipu 4V (#4146)
* Prefer explicit pricing for compact models (#4156)
* Fix document rendering (#4153)

#### Improvements
* Refine PR template and add PR submission checks (#4076)

---

### What's Changed
* fix(zhipu_4v): use correct endpoint for coding plan image generation by @NyaMisty in https://github.com/QuantumNous/new-api/pull/4146
* fix: prefer explicit pricing for compact models by @seefs001 in https://github.com/QuantumNous/new-api/pull/4156
* fix(ali): accept string usage values in task polling by @seefs001 in https://github.com/QuantumNous/new-api/pull/4155
* feat: fill in some custom fields for vllm-omini by @seefs001 in https://github.com/QuantumNous/new-api/pull/4154
* fix: document render by @seefs001 in https://github.com/QuantumNous/new-api/pull/4153
* ci: refine PR template and add PR submission checks by @seefs001 in https://github.com/QuantumNous/new-api/pull/4076

### New Contributors
* @NyaMisty made their first contribution in https://github.com/QuantumNous/new-api/pull/4146

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.5...v0.12.6

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/New-API-App.0.12.6.exe">New-API-App.0.12.6.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/New-API-App.Setup.0.12.6.exe">New-API-App.Setup.0.12.6.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/new-api-arm64-v0.12.6">new-api-arm64-v0.12.6</a> (63.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/new-api-macos-v0.12.6">new-api-macos-v0.12.6</a> (81.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/new-api-v0.12.6">new-api-v0.12.6</a> (65.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.6/new-api-v0.12.6.exe">new-api-v0.12.6.exe</a> (67.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.6.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.6.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## nightly-20260409-4d2993e

<Callout type="note" title="正式版本 · 发布于 2026-04-09 17:14:49 (中国时间)">

#### Highlights / 重点更新

This release introduces comprehensive support for **tiered billing (阶梯计费)**. It allows for flexible pricing expressions, detailed tool call quota calculations, and channel test support for tiered models. 
本次发布重点增加了对**阶梯计费**的全面支持，支持灵活的计费表达式解析、自定义工具调用额度计算，并完善了UI配置项和渠道测试支持。

**Docker image:** `calciumion/new-api:nightly`
**Docker 镜像:** `calciumion/new-api:nightly`

<img width="500" alt="" src="https://github.com/user-attachments/assets/893d5789-64b3-414d-8e71-cc178b724ac6" />

#### New Features
* Added comprehensive support for tiered billing, including flexible expression evaluation, tool pricing settings UI, and channel test support (#4145).
* Added custom fields support for vllm-omini models (#4154).

#### Bug Fixes
* Fixed an issue in Alibaba Cloud task polling to correctly accept string usage values (#4155).
* Fixed the endpoint for Zhipu 4v coding plan image generation (#4146).
* Fixed pricing calculation to prefer explicit pricing for compact models (#4156).

#### Improvements
* Improved UI layout consistency by replacing card components with divs.
* Added nightly branch trigger to Docker image CI workflows.
* Refined PR templates and added PR submission checks (#4076).

---

### What's Changed
* fix(zhipu_4v): use correct endpoint for coding plan image generation by @NyaMisty in https://github.com/QuantumNous/new-api/pull/4146
* fix: prefer explicit pricing for compact models by @seefs001 in https://github.com/QuantumNous/new-api/pull/4156
* fix(ali): accept string usage values in task polling by @seefs001 in https://github.com/QuantumNous/new-api/pull/4155
* feat: fill in some custom fields for vllm-omini by @seefs001 in https://github.com/QuantumNous/new-api/pull/4154
* fix: document render by @seefs001 in https://github.com/QuantumNous/new-api/pull/4153
* ci: refine PR template and add PR submission checks by @seefs001 in https://github.com/QuantumNous/new-api/pull/4076
* fix(channel-test): support tiered billing model tests by @yyhhyyyyyy in https://github.com/QuantumNous/new-api/pull/4145

### New Contributors
* @NyaMisty made their first contribution in https://github.com/QuantumNous/new-api/pull/4146

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.5...nightly-20260409

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/nightly-20260409.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/nightly-20260409.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.5

<Callout type="note" title="正式版本 · 发布于 2026-04-08 17:13:32 (中国时间)">

#### New Features
* Add support for Minimax image generation relay (#4103).

#### Improvements
* Redesign group ratio rules with a collapsible layout for better usability.
* Enhance dashboard chart axes and sorting logic.
* Add a convenient copy button next to the API link in the dashboard info panel.

#### Bug Fixes
* Resolve email delivery issues for Outlook and similar providers (#4112).

<img width="2848" height="966" alt="" src="https://github.com/user-attachments/assets/8cfdd943-3b2a-4e2a-9f7f-301468d64ce2" />


---

### What's Changed
* feat: 支持强制使用 AUTH LOGIN 以解决 outlook 等邮箱的发件问题 by @Hoshino-Yumetsuki in https://github.com/QuantumNous/new-api/pull/4112
* feat(minimax): add image generation relay support by @forsakenyang in https://github.com/QuantumNous/new-api/pull/4103

### New Contributors
* @Hoshino-Yumetsuki made their first contribution in https://github.com/QuantumNous/new-api/pull/4112
* @forsakenyang made their first contribution in https://github.com/QuantumNous/new-api/pull/4103

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.4...v0.12.5

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.5/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.5/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.5/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.5/new-api-arm64-v0.12.5">new-api-arm64-v0.12.5</a> (63.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.5/new-api-macos-v0.12.5">new-api-macos-v0.12.5</a> (81.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.5/new-api-v0.12.5">new-api-v0.12.5</a> (65.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.5/new-api-v0.12.5.exe">new-api-v0.12.5.exe</a> (67.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.5.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.5.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.4

<Callout type="note" title="正式版本 · 发布于 2026-04-08 15:49:44 (中国时间)">

### New Features
* Added an `IncludeModelName` option to channel affinity rules for per-model affinity tracking (#3488)
* Added an ErrorBoundary component to the web UI to prevent full-page crashes (#3350)
* Added support for `Duration` in `TaskSubmitReq` (#4068)
* Added admin user analytics to the dashboard

### Bug Fixes
* Fixed pricing filtering based on usable groups (#4123)
* Fixed an issue where Claude streaming interruptions incorrectly overwrote usage data instead of preserving cache billing fields (#4128)
* Fixed an issue where the "do not retry after failure" configuration was incorrectly overwritten in memory (#4142)

### Improvements
* Added support for enabling error logging via environment variables (#4131)
* Wrapped scope tag labels with `t()` for better i18n support
* Fixed chart labels on the dashboard

---

### What's Changed
* feat: add IncludeModelName option to channel affinity rules by @clansty in https://github.com/QuantumNous/new-api/pull/3488
* feat: add ErrorBoundary to prevent full-page crashes by @goodmorning10 in https://github.com/QuantumNous/new-api/pull/3350
* fix: Claude 流式断流时不再整份覆盖 usage，保留 cache 计费字段 by @zuiho-kai in https://github.com/QuantumNous/new-api/pull/4128
* fix(pricing): add filtering for pricing based on usable groups by @bbbugg in https://github.com/QuantumNous/new-api/pull/4123
* chore(deps): bump github.com/aws/aws-sdk-go-v2/service/bedrockruntime from 1.50.0 to 1.50.4 by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/4136
* add 添加 启用错误日志记录到env配置中 by @binorxin in https://github.com/QuantumNous/new-api/pull/4131
* Seedance support duration by @feitianbubu in https://github.com/QuantumNous/new-api/pull/4068
* fix: 修复 失败后不重试 配置项写到内存被覆盖 by @seefs001 in https://github.com/QuantumNous/new-api/pull/4142

### New Contributors
* @clansty made their first contribution in https://github.com/QuantumNous/new-api/pull/3488
* @goodmorning10 made their first contribution in https://github.com/QuantumNous/new-api/pull/3350
* @zuiho-kai made their first contribution in https://github.com/QuantumNous/new-api/pull/4128
* @bbbugg made their first contribution in https://github.com/QuantumNous/new-api/pull/4123

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.3...v0.12.4

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/New-API-App.0.12.4.exe">New-API-App.0.12.4.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/New-API-App.Setup.0.12.4.exe">New-API-App.Setup.0.12.4.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/new-api-arm64-v0.12.4">new-api-arm64-v0.12.4</a> (63.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/new-api-macos-v0.12.4">new-api-macos-v0.12.4</a> (81.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/new-api-v0.12.4">new-api-v0.12.4</a> (65.7 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.4/new-api-v0.12.4.exe">new-api-v0.12.4.exe</a> (67.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.4.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.4.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.3

<Callout type="note" title="正式版本 · 发布于 2026-04-08 01:04:04 (中国时间)">

This is a small polish release focused on making configuration easier to navigate by simplifying the settings layout and consolidating model pricing controls.

### Improvements
- Refined the settings interface with a unified model pricing view and a cleaner tab structure to make configuration easier to navigate.

---

### What's Changed
* feat(token): add batch API for fetching token keys by @RedwindA in https://github.com/QuantumNous/new-api/pull/4114


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.2...v0.12.3

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/New-API-App.0.12.3.exe">New-API-App.0.12.3.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/New-API-App.Setup.0.12.3.exe">New-API-App.Setup.0.12.3.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/new-api-arm64-v0.12.3">new-api-arm64-v0.12.3</a> (63.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/new-api-macos-v0.12.3">new-api-macos-v0.12.3</a> (81.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/new-api-v0.12.3">new-api-v0.12.3</a> (65.6 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.3/new-api-v0.12.3.exe">new-api-v0.12.3.exe</a> (67.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.3.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.3.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.2

<Callout type="note" title="正式版本 · 发布于 2026-04-06 18:10:52 (中国时间)">

#### New Features
* Add support for PDF conversion between OpenAI and Claude APIs.
* Support differential billing for Seedance 2.0 based on video vs. no-video input.
* Enhance max_tokens handling and input sanitization in the playground (#4106).
* Enhance stream status display with error tooltips in usage logs.

#### Bug Fixes
* Fix usage calculation issues when converting between Claude and OpenAI APIs by emitting `message_delta` for the final stream chunk (#4090).
* Fix Gemini stream detection by checking the `:streamGenerateContent` URL path (#4087).
* Fix Claude request requirements by properly setting TopP to nil.

#### Improvements
* Unify file source creation and enhance caching mechanisms.

---

### What's Changed
* fix(gemini): detect streaming from URL path :streamGenerateContent by @D26FORWARD in https://github.com/QuantumNous/new-api/pull/4087
* fix: emit claude message_delta for usage-only final stream chunk by @seefs001 in https://github.com/QuantumNous/new-api/pull/4090
* chore(deps-dev): bump electron from 35.7.5 to 39.8.5 in /electron by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/4080
* chore(deps-dev): bump @xmldom/xmldom from 0.8.11 to 0.8.12 in /electron by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/3523
* chore(deps-dev): bump lodash from 4.17.23 to 4.18.1 in /electron by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/4097
* feat(playground): enhance max_tokens handling and input sanitization by @HynoR in https://github.com/QuantumNous/new-api/pull/4106

### New Contributors
* @D26FORWARD made their first contribution in https://github.com/QuantumNous/new-api/pull/4087

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.1...v0.12.2

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/New-API-App.0.12.2.exe">New-API-App.0.12.2.exe</a> (106.3 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/New-API-App.Setup.0.12.2.exe">New-API-App.Setup.0.12.2.exe</a> (106.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/new-api-arm64-v0.12.2">new-api-arm64-v0.12.2</a> (63.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/new-api-macos-v0.12.2">new-api-macos-v0.12.2</a> (81.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/new-api-v0.12.2">new-api-v0.12.2</a> (65.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.2/new-api-v0.12.2.exe">new-api-v0.12.2.exe</a> (67.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.2.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.2.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.1

<Callout type="note" title="正式版本 · 发布于 2026-04-02 22:01:41 (中国时间)">

This release adds Seedance 2.0 video support and broadens media compatibility across providers. It also makes failures easier to understand with clearer Seedance and performance-related error messages.

### New Features
- Added Seedance 2.0 video generation API support with duration control in seconds, clearer failure reporting, and better prompt handling for single-text requests (#4042).
- Added HEIC/HEIF image support, including Gemini channel compatibility and more reliable handling of HEIF images (#4049).
- Added basic inline file support for Claude relay so compatible requests can include media directly (#3505).

### Improvements
- Improved performance-related error messages to make request failures easier to understand.

---

### What's Changed
* fix: add basic inline file support for Claude relay by @seefs001 in https://github.com/QuantumNous/new-api/pull/3505
* 新增seedance2.0视频接口支持 by @feitianbubu in https://github.com/QuantumNous/new-api/pull/4042
* feat: add HEIC/HEIF image format support for Gemini channel by @RedwindA in https://github.com/QuantumNous/new-api/pull/4049


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.0...v0.12.1

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/New-API-App.0.12.1.exe">New-API-App.0.12.1.exe</a> (96.8 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/New-API-App.Setup.0.12.1.exe">New-API-App.Setup.0.12.1.exe</a> (97.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/new-api-arm64-v0.12.1">new-api-arm64-v0.12.1</a> (63.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/new-api-macos-v0.12.1">new-api-macos-v0.12.1</a> (81.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/new-api-v0.12.1">new-api-v0.12.1</a> (65.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.1/new-api-v0.12.1.exe">new-api-v0.12.1.exe</a> (67.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.1.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.1.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.0

<Callout type="note" title="正式版本 · 发布于 2026-04-02 00:22:05 (中国时间)">

v0.12.0 adds Wan 2.7 image generation support and streamlines channel setup in the admin UI. It also improves billing accuracy and fixes several model and dashboard issues.

### New Features
- Added support for Wan 2.7 image generation, including control over how many images are generated per request (#3526).

### Bug Fixes
- Fixed image-generation billing and usage statistics so request counts and costs are reported more accurately without double-counting (#3512).
- Fixed a UI issue that caused the consumption distribution chart to make the page scrollbar flicker on hover (#3474).
- Fixed xAI Grok-3-mini compatibility when no completion token limit is set, reducing failed requests.

### Improvements
- Made channel setup faster and smoother by letting you create a channel from a copied token, remembering advanced settings in the edit dialog, and improving clipboard handling.

---

### What's Changed
* fix(dashboard): 修复消耗分布图表悬浮时滚动条闪烁 by @wans10 in https://github.com/QuantumNous/new-api/pull/3474
* docs(zh-TW): fix missing content and add partner logo by @DaZuiZui in https://github.com/QuantumNous/new-api/pull/3462
* chore(deps-dev): bump picomatch from 4.0.3 to 4.0.4 in /electron by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/3450
* fix: prevent double-counting of image count n in billing by @imlhb in https://github.com/QuantumNous/new-api/pull/3512
* 支持wan2.7生图-wan2.7-image by @feitianbubu in https://github.com/QuantumNous/new-api/pull/3526

### New Contributors
* @DaZuiZui made their first contribution in https://github.com/QuantumNous/new-api/pull/3462
* @imlhb made their first contribution in https://github.com/QuantumNous/new-api/pull/3512

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.11.9...v0.12.0

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/New-API-App.0.12.0.exe">New-API-App.0.12.0.exe</a> (96.8 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/New-API-App.Setup.0.12.0.exe">New-API-App.Setup.0.12.0.exe</a> (97.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/new-api-arm64-v0.12.0">new-api-arm64-v0.12.0</a> (63.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/new-api-macos-v0.12.0">new-api-macos-v0.12.0</a> (81.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/new-api-v0.12.0">new-api-v0.12.0</a> (65.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.12.0/new-api-v0.12.0.exe">new-api-v0.12.0.exe</a> (67.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.0.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.0.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.0-alpha.2

<Callout type="note" title="正式版本 · 发布于 2026-03-31 21:43:12 (中国时间)">

### Release Highlights
This release includes minor improvements to the `EditChannelModal` component to enhance clipboard handling reliability.

### Bug Fixes
- **EditChannelModal:** Enhance clipboard handling with error checks (`670abee`)

---

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.12.0-alpha.1...v0.12.0-alpha.2

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.0-alpha.2.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.0-alpha.2.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.12.0-alpha.1

<Callout type="note" title="正式版本 · 发布于 2026-03-31 19:40:48 (中国时间)">

### Highlights
This release introduces a new clipboard magic string feature for quick channel creation and includes important security and UI improvements.

### New Features
* Add clipboard magic string for quick channel creation from token copy

### Bug Fixes
* 修复消耗分布图表悬浮时滚动条闪烁 (Fix dashboard scrollbar flickering) (#3474)
* Fix xAI MaxTokens mapping for grok-3-mini model

### Improvements
* Security improvements
* Enhance footer layout and styling
* Update Traditional Chinese README with missing content and partner logo (#3462)
* Refactor account binding endpoints to use POST and normalize reset responses

---

### What's Changed
* fix(dashboard): 修复消耗分布图表悬浮时滚动条闪烁 by @wans10 in https://github.com/QuantumNous/new-api/pull/3474
* docs(zh-TW): fix missing content and add partner logo by @DaZuiZui in https://github.com/QuantumNous/new-api/pull/3462

### New Contributors
* @DaZuiZui made their first contribution in https://github.com/QuantumNous/new-api/pull/3462

**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.11.9...v0.12.0-alpha.1

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.0-alpha.1.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.12.0-alpha.1.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---

## v0.11.9

<Callout type="note" title="正式版本 · 发布于 2026-03-31 17:07:05 (中国时间)">

### Release Notes for v0.11.9

#### New Features
* Add slide-in animations and update translations for new UI elements
* Prevent metadata from overriding model fields (#3461)
* Record stream interruption reasons via StreamStatus
* Expose i18n instance to the global window object for easier access

#### Bug Fixes
* Restore pre-3400 OpenRouter billing semantics (#3438)
* Restore doubao coding plan deprecation and regex ignored models lost during conflict resolution
* Preserve cache usage in openai-to-claude response conversion

#### Improvements
* Expose skip-retry option and show it in the rules list (#3440)
* Harden Docker and release CI workflows to improve security

---

### What's Changed
* fix: restore pre-3400 OpenRouter billing semantics by @seefs001 in https://github.com/QuantumNous/new-api/pull/3438
* refactor: expose skip-retry option and show it in rules list by @seefs001 in https://github.com/QuantumNous/new-api/pull/3440
* feat: prevent metadata from overriding model fields by @feitianbubu in https://github.com/QuantumNous/new-api/pull/3461
* chore(deps): bump golang.org/x/image from 0.23.0 to 0.38.0 by @dependabot[bot] in https://github.com/QuantumNous/new-api/pull/3507


**Full Changelog**: https://github.com/QuantumNous/new-api/compare/v0.11.9-alpha.1...v0.11.9

**下载资源**

<ul>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/checksums-linux.txt">checksums-linux.txt</a> (170 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/checksums-macos.txt">checksums-macos.txt</a> (88 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/checksums-windows.txt">checksums-windows.txt</a> (86 B)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/New-API-App.0.11.9.exe">New-API-App.0.11.9.exe</a> (96.8 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/New-API-App.Setup.0.11.9.exe">New-API-App.Setup.0.11.9.exe</a> (97.0 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/new-api-arm64-v0.11.9">new-api-arm64-v0.11.9</a> (63.2 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/new-api-macos-v0.11.9">new-api-macos-v0.11.9</a> (81.4 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/new-api-v0.11.9">new-api-v0.11.9</a> (65.5 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/releases/download/v0.11.9/new-api-v0.11.9.exe">new-api-v0.11.9.exe</a> (67.1 MB)</li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.11.9.zip">Source code (zip)</a></li>
<li><a href="https://github.com/QuantumNous/new-api/archive/refs/tags/v0.11.9.tar.gz">Source code (tar.gz)</a></li>
</ul>

</Callout>

---
