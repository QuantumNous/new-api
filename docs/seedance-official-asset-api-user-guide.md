# Seedance 官方素材 API — 用户说明

与 83zi 网关（`/api/seedance/*`）**并行**的火山方舟私域素材库直连接口。

| 项目 | 说明 |
|------|------|
| Base 路径 | `/api/seedance/official` |
| 认证 | `Authorization: Bearer sk-本站令牌` |
| 上游 | 管理员配置的控制台 `AK\|SK`（V4 签名） |
| 响应 | `{ "success", "message", "data", "code"? }` |

接口列表与 `/api/seedance/*` 相同（12 个），仅前缀改为 `/api/seedance/official`。

## 管理员配置

1. 渠道管理新建渠道，Key 填 `AK|SK` 或 `AK|SK|Region`。Base URL 可空。
2. 运营设置 → **Seedance 官方素材网关**：
   - 启用，填写该渠道 ID
   - **官方素材平台**选择：
     - `国内火山（cn-beijing）` → Host `ark.cn-beijing.volcengineapi.com`
     - `海外 BytePlus（ap-southeast-1）` → Host `ark.ap-southeast-1.byteplusapi.com`
   - 配置默认真人 CallbackURL
3. 客户使用本站 `sk-` 调用官方路径。

国内与海外为可切换配置，互不替换；Key 第三段 `Region` 可覆盖平台默认 Region，渠道 Base URL 可覆盖默认 Host。

## 快速示例

```bash
export BASE="https://your-host"
export TOKEN="sk-你的令牌"

# 创建 AIGC 素材组
curl -s -X POST "$BASE/api/seedance/official/asset-groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group_name":"demo","group_type":"AIGC"}'

# 远程 URL 资产认证
curl -s -X POST "$BASE/api/seedance/official/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/ref.jpg","type":"image","group_id":"group-xxx"}'

# 轮询素材状态
curl -s "$BASE/api/seedance/official/assets/asset-xxx" \
  -H "Authorization: Bearer $TOKEN"
```

素材 `active` 后，将 `asset_uri`（`asset://...`）填入视频生成 `content`。须与官方同账号/项目体系一致。

## 真人认证

```bash
# 可用运营默认 CallbackURL，或请求体覆盖
curl -s -X POST "$BASE/api/seedance/official/real-person-auth/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"callback_url":"https://your-app.com/callback"}'

curl -s -X POST "$BASE/api/seedance/official/real-person-auth/asset-group" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"byted_token":"cv-token-..."}'
```

完整契约说明见设计文档：`docs/superpowers/specs/2026-08-08-seedance-official-asset-design.md`。
