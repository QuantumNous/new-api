# Seedance 素材 API 双用户联调与隔离测试报告

日期：2026-07-15  
环境：`http://127.0.0.1:3000`  
网关渠道：ID `14`（已启用 Seedance 素材网关）  
结论：**通过**（12 个接口正向可用；跨用户隔离符合预期）

---

## 1. 测试账号与素材

| 角色 | 说明 |
|------|------|
| 用户 1 | 令牌 A（下文称 U1） |
| 用户 2 | 令牌 B（下文称 U2） |

公网图片：

1. `https://lsky.zhongzhuan.chat/i/2026/06/15/6a2ff99bc8e00.jpg`
2. `https://lsky.zhongzhuan.chat/i/2026/06/15/6a2ff99bd83f6.jpg`
3. `https://lsky.zhongzhuan.chat/i/2026/06/05/6a22de507d4e7.png`

> 报告中不落真实 `sk-`。联调后请酌情轮换 Key。

---

## 2. 总览

| 类别 | 结果 |
|------|------|
| 素材组 CRUD（本人） | 通过 |
| 素材远程认证 / 查询 / 更新 / 删除（本人） | 通过 |
| 真人认证 sessions | 通过（返回 `byted_token` + `h5_link`） |
| bytedToken 换组（无效 token） | 通过（上游拒绝，符合预期） |
| bytedToken 换组（真实活体） | **未测**（需手机完成 H5） |
| 跨用户隔离 | **全部通过** |
| 上传 `POST /upload` | 本期范围外，未测 |

---

## 3. 正向用例摘要

### 3.1 素材组

| 步骤 | 调用方 | 结果 |
|------|--------|------|
| 创建 AIGC 组 | U1 | 200，`group_id=group-20260715151913-fc4hn` |
| 创建 AIGC 组 | U2 | 200，`group_id=group-20260715151915-fhphv` |
| query 列表 | U1 | 200，`total=1`，仅本人组 |
| query 列表 | U2 | 200，`total=1`，仅本人组 |
| PATCH 改名/描述 | U1 | 200，`group_name=u1-renamed` |
| DELETE | U1 / U2 | 200，`deleted=true`（清理阶段） |

### 3.2 素材

| 步骤 | 调用方 | 结果 |
|------|--------|------|
| `POST /assets` + 本人 `group_id` + 图1 | U1 | 200，`aicc_asset_id=asset-20260715151920-nxq85`，初始 `processing` |
| `POST /assets` 不传 group（默认组）+ 图2 | U1 | 200，落入平台默认组 `group-20260709224054-4l9vj` |
| `POST /assets` + 本人组 + 图3 | U2 | 200，`aicc_asset_id=asset-20260715151927-wnl5j` |
| assets/query | U1 | 200，`total=2`，无 U2 素材 |
| assets/query | U2 | 200，`total=1`，无 U1 素材 |
| GET 本人素材 | U1 | 200；回源后 `status=active` |
| GET 本人素材 | U2 | 200；当时仍为 `processing`（轮询正常） |
| PATCH filename | U1 | 200，`filename=u1-renamed.jpg` |
| DELETE | U1 / U2 | 200，清理成功 |

### 3.3 真人认证

| 步骤 | 调用方 | 结果 |
|------|--------|------|
| `POST .../sessions` | U1 / U2 | 200，均返回 `byted_token`、`h5_link`、`expires_in=120` |
| `POST .../asset-group` + 无效 token | U1 | 400，`upstream_error`（上游：素材组不存在或 Token 无效） |

真实活体需人工打开 `h5_link` 完成后再调换组，本轮自动化未覆盖。

---

## 4. 隔离交叉用例（核心）

| # | 操作 | 期望 | 实际 | 判定 |
|---|------|------|------|------|
| C1 | U2 GET U1 的 `group_id` | 404 | 404，`code=group_not_found`，`message=素材组不存在` | 通过 |
| C2 | U1 GET U2 的 `group_id` | 404 | 404 | 通过 |
| C3 | U2 PATCH U1 素材组 | 404 | 404 | 通过 |
| C4 | U2 `POST /assets` 使用 U1 的 `group_id` | 403 | 403，`code=group_forbidden`，`message=素材组不存在或无权使用` | 通过 |
| C5 | U2 GET U1 本地 `asset_id` | 404 | 404 | 通过 |
| C6 | U2 GET U1 的 `aicc_asset_id` | 404 | 404 | 通过 |
| C7 | U1 GET U2 `asset_id` | 404 | 404 | 通过 |
| C8 | U2 PATCH U1 素材 | 404 | 404 | 通过 |
| C9 | U2 DELETE U1 素材 | 404 | 404 | 通过 |
| C10 | U2 DELETE U1 素材组 | 404 | 404 | 通过 |
| C11 | 列表串户 | U1/U2 query 不含对方资源 | 符合 | 通过 |

结论：共享上游渠道 Key 时，**本地按 user_id 归属隔离生效**，无法读写对方素材组/素材。

---

## 5. 关键响应摘录

### 创建组（U1）

```json
{
  "success": true,
  "data": {
    "id": 1,
    "group_id": "group-20260715151913-fc4hn",
    "group_type": "AIGC",
    "group_name": "u1-test-aigc",
    "status": "active"
  }
}
```

### 远程认证（U1）

```json
{
  "success": true,
  "data": {
    "asset_id": 1,
    "aicc_asset_id": "asset-20260715151920-nxq85",
    "asset_uri": "asset://asset-20260715151920-nxq85",
    "status": "processing",
    "url": "https://lsky.zhongzhuan.chat/i/2026/06/15/6a2ff99bc8e00.jpg"
  }
}
```

### 跨用户使用对方 group（U2 → U1 group）

```json
{
  "success": false,
  "code": "group_forbidden",
  "message": "素材组不存在或无权使用",
  "data": null
}
```

### 跨用户读取对方组

```json
{
  "success": false,
  "code": "group_not_found",
  "message": "素材组不存在",
  "data": null
}
```

---

## 6. 覆盖对照（12 接口）

| 接口 | 正向 | 隔离/负向 |
|------|------|-----------|
| `POST /asset-groups` | 已测 | — |
| `POST /asset-groups/query` | 已测 | 不串户 |
| `GET /asset-groups/{id}` | 已测 | 跨用户 404 |
| `PATCH /asset-groups/{id}` | 已测 | 跨用户 404 |
| `DELETE /asset-groups/{id}` | 已测 | 跨用户 404 |
| `POST /assets` | 已测（含默认组） | 他人 group → 403 |
| `POST /assets/query` | 已测 | 不串户 |
| `GET /assets/{id}` | 已测（含回源 active） | 跨用户 404（本地 id / aicc id） |
| `PATCH /assets/{id}` | 已测 | 跨用户 404 |
| `DELETE /assets/{id}` | 已测 | 跨用户 404 |
| `POST /real-person-auth/sessions` | 已测 | — |
| `POST /real-person-auth/asset-group` | 无效 token 已测 | 真实活体待人工 |

---

## 7. 遗留与建议

1. **真人换组完整链路**：需用返回的 `h5_link` 在手机完成活体后，再调 `asset-group` 验证绑定到对应用户。
2. **素材状态**：创建后多为 `processing`，GET 回源可变为 `active`；自动化测试可对仍 `processing` 的资产加短轮询。
3. **安全**：本轮使用的两把 Key 已出现在对话中，建议联调结束后禁用或轮换。
4. curl 手册：`docs/seedance-asset-api-curl.md`。

---

## 8. 最终判定

| 项目 | 判定 |
|------|------|
| 功能可用性 | 通过 |
| 租户隔离 | 通过 |
| 公网图片远程认证 | 通过 |
| 可上线联调（素材管理） | **是**（真人完整活体除外） |

*报告生成于自动化双用户交叉测试之后 · 2026-07-15*
