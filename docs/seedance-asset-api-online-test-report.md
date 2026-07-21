# Seedance 素材 API 线上联调报告（sd2.ffir.cn）

日期：2026-07-15  
环境：`https://sd2.ffir.cn`  
结论：**通过**（31/31；12 个接口正向 + 跨用户隔离均符合预期）

---

## 1. 测试说明

| 项 | 内容 |
|------|------|
| Base URL | `https://sd2.ffir.cn` |
| 用户 1 / 用户 2 | 两把不同账号的 `sk-` 令牌（报告中不落真实密钥） |
| 公网图片 | `lsky.zhongzhuan.chat` 三张 JPG/PNG |
| 对照 | 本地 `127.0.0.1:3000` 报告见 `docs/seedance-asset-api-test-report.md` |

真人完整活体换组需手机打开 `h5_link`，本轮仅验证 sessions 成功 + 无效 token 失败。

---

## 2. 总览

| 类别 | 结果 |
|------|------|
| 素材组 CRUD | 通过 |
| 素材远程认证 / 查询 / 更新 / 删除 | 通过 |
| 真人 sessions | 通过 |
| 无效 bytedToken 换组 | 通过（HTTP 400 `upstream_error`） |
| 跨用户隔离 | **全部通过** |
| 统计 | **PASS=31 / FAIL=0** |

---

## 3. 关键 ID（本轮）

| 资源 | 值 |
|------|------|
| U1 素材组 | `group-20260715162309-vqb9f` |
| U2 素材组 | `group-20260715162311-7x4vk` |
| U1 素材（组内） | local `1` / `asset-20260715162316-qp2s7` |
| U1 素材（默认组） | local `2` / `asset-20260715162320-xpdbn` |
| U2 素材 | local `3` / `asset-20260715162325-pqq9m` |
| U1 GET 回源后状态 | `active` |
| U1 列表 total | 2（组内+默认） |
| U2 列表 total | 1 |

测试结束已删除本轮创建的素材与素材组（含探测残留组）。

---

## 4. 正向用例

| 步骤 | 调用方 | HTTP | 判定 |
|------|--------|------|------|
| 创建 AIGC 组 | U1 / U2 | 200 | PASS |
| query 素材组 | U1 / U2 | 200；各自仅见本人组 | PASS |
| PATCH 素材组 | U1 | 200，`prod-u1-renamed` | PASS |
| `POST /assets` + 本人 group + 图1 | U1 | 200，`processing`→GET 后 `active` | PASS |
| `POST /assets` 默认组 + 图2 | U1 | 200 | PASS |
| `POST /assets` + 本人 group + 图3 | U2 | 200 | PASS |
| assets/query | U1 / U2 | 200；不串户 | PASS |
| GET / PATCH 本人素材 | U1 / U2 | 200 | PASS |
| real-person sessions | U1 / U2 | 200，返回 `byted_token` + `h5_link` | PASS |
| DELETE 本人素材/组 | U1 / U2 | 200 | PASS |

---

## 5. 隔离交叉用例

| # | 操作 | 期望 | 实际 | 判定 |
|---|------|------|------|------|
| C1 | U2 GET U1 `group_id` | 404 | 404 `group_not_found` | PASS |
| C2 | U1 GET U2 `group_id` | 404 | 404 `group_not_found` | PASS |
| C3 | U2 PATCH U1 组 | 404 | 404 | PASS |
| C4 | U2 `POST /assets` 用 U1 `group_id` | 403 | 403 `group_forbidden` | PASS |
| C5 | U2 GET U1 `asset_id` | 404 | 404 `asset_not_found` | PASS |
| C6 | U2 GET U1 `aicc_asset_id` | 404 | 404 | PASS |
| C7 | U1 GET U2 `asset_id` | 404 | 404 | PASS |
| C8 | U2 PATCH U1 素材 | 404 | 404 | PASS |
| C9 | U2 DELETE U1 素材 | 404 | 404 | PASS |
| C10 | U2 DELETE U1 组 | 404 | 404 | PASS |

---

## 6. 响应摘录

### 跨用户使用对方 group

```json
{
  "success": false,
  "code": "group_forbidden",
  "message": "素材组不存在或无权使用",
  "data": null
}
```

### 跨用户读取对方素材

```json
{
  "success": false,
  "code": "asset_not_found",
  "message": "素材不存在",
  "data": null
}
```

### 无效 bytedToken

```json
{
  "success": false,
  "code": "upstream_error",
  "message": "素材库接口失败: HTTP 400 素材组不存在或Token无效",
  "data": null
}
```

---

## 7. 与本地测试对比

| 项 | 本地 `127.0.0.1:3000` | 线上 `sd2.ffir.cn` |
|------|----------------------|---------------------|
| 12 接口可用性 | 通过 | 通过 |
| 隔离 | 通过 | 通过 |
| 公网图认证 | 通过 | 通过 |
| GET 回源 active | 通过 | 通过 |
| 真人完整活体 | 未人工完成 | 未人工完成 |

线上与本地行为一致，可认为**生产环境素材管理接口已就绪**。

---

## 8. 遗留

1. 真人活体完整链路：打开 sessions 返回的 `h5_link` → 完成认证 → `asset-group` 换 `LivenessFace` 组 → 带 `group_id` 认证人脸图。  
2. 两把线上 Key 已在对话中出现，建议测完后视情况轮换。  
3. 用户文档：`docs/seedance-asset-api-user-guide.md`（Domain: `https://sd2.ffir.cn`）。

---

## 9. 最终判定

| 项目 | 判定 |
|------|------|
| 功能可用性 | **通过** |
| 租户隔离 | **通过** |
| 可对客户开放 | **是**（真人完整活体除外，按需人工补测） |

*自动化双用户交叉测试 · 2026-07-15 · https://sd2.ffir.cn*
