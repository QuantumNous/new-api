# 火山引擎素材 API · 可复现测试用例

本文档收录已在 new-api 网关侧**完整跑通**的素材（Asset）接口测试用例，可直接复制命令复现。

> API 语义与字段说明见 [volc-asset-api.md](./volc-asset-api.md)；管理员配置见 [volc-asset-config.md](./volc-asset-config.md)。
> 与 Seedance 视频联调见 [seedance-video-api.md](./seedance-video-api.md) 第 7 节。

---

## 1. 测试环境

| 项 | 值 |
| --- | --- |
| Host | `http://43.156.53.249:25873`（替换为你的 new-api 地址） |
| Token | `sk-YOUR_TOKEN`（替换为控制台签发的 API 令牌） |
| Base URL | `{HOST}/doubao/open` |
| 方法 | 全部 `POST`，路径指定 Action |

### 公共请求头

```http
Authorization: Bearer sk-YOUR_TOKEN
Content-Type: application/json
```

多出口部署时可选 `X-Asset-Outbound: <出口ID>`，或查询参数 `?outbound=<出口ID>`。

### 推荐测试图片 URL

以下 URL 已在上述实例上验证 **CreateAsset 可成功**：

```
https://picsum.photos/800/600.jpg                                     # 非真人（风景/随机）
https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800    # 含真人（用于 asset:// 用例）
```

**CreateAsset 常见失败原因（上游校验）：**

| 现象 | 原因 |
| --- | --- |
| `DownloadFailed` | URL 公网不可达，或火山上游拉取返回 403/404 |
| `HeightTooSmall` | 图片高度 < 300px（如网站 favicon、小 logo） |
| `HeightTooLarge` | 图片高度 > 6000px |

文档中的 `https://example.com/photo.png` **不能**用于真实测试。

---

## 2. 用例总览

| # | 用例 | 接口 | 期望 HTTP | 角色 |
| --- | --- | --- | --- | --- |
| TC-01 | 列出素材（初始空列表） | `ListAssets` | 200 | 普通用户 |
| TC-02 | 创建素材 | `CreateAsset` | 200 | 普通用户 |
| TC-03 | 查询素材状态（轮询） | `GetAsset` | 200 | 普通用户 |
| TC-04 | 更新素材名称 | `UpdateAsset` | 200 | 普通用户 |
| TC-05 | 列出素材（含筛选） | `ListAssets` | 200 | 普通用户 |
| TC-06 | 删除素材 | `DeleteAsset` | 200 | 普通用户 |
| TC-07 | 删除后再次查询 | `GetAsset` | 502* | 普通用户 |
| TC-08 | 缺少 Id 参数 | `GetAsset` | 400 | 普通用户 |
| TC-09 | 不存在的素材 Id | `GetAsset` | 502* | 普通用户 |
| TC-10 | 非管理员访问分组接口 | `ListAssetGroups` | 403 | 普通用户 |
| TC-11 | 管理员列出分组（可选） | `ListAssetGroups` | 200 | 管理员 |
| TC-12 | 非真人素材 URL 提交视频（可选） | `/v1/video/generations` | 200 | 普通用户 |
| TC-13 | **真人图片必须用 `asset://` 引用** | `/v1/video/generations` | 见下 | 普通用户 |

\* 删除后或不存在的 Id：网关透传火山上游错误，HTTP 常为 502，body 含 `NotFound` / `InvalidParameter`（见 TC-07、TC-09）。

---

## 3. 分步用例（curl）

将 `{HOST}`、`sk-YOUR_TOKEN` 替换为实际值。以下 `{ASSET_ID}` 由 TC-02 返回的 `Id` 填入。

### TC-01 · ListAssets（初始）

```bash
curl -sS -X POST '{HOST}/doubao/open/ListAssets' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"PageNumber":1,"PageSize":20}'
```

**期望响应（200）：**

```json
{ "Items": [], "PageNumber": 1, "PageSize": 20, "TotalCount": 0 }
```

---

### TC-02 · CreateAsset

```bash
curl -sS -X POST '{HOST}/doubao/open/CreateAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "URL": "https://picsum.photos/800/600.jpg",
    "AssetType": "Image",
    "Name": "asset-test"
  }'
```

**期望响应（200）：**

```json
{ "Id": "asset-20260701072414-w7q99" }
```

> `Id` 格式为 `asset-yyyymmddHHmmss-xxxxx`。保存此 Id 供后续用例使用。
> 无需传 `GroupId` / `ProjectName`，服务端自动落到用户专属分组 `newapi-user-{用户ID}`。

---

### TC-03 · GetAsset（轮询至 Active）

```bash
curl -sS -X POST '{HOST}/doubao/open/GetAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"Id":"{ASSET_ID}"}'
```

**期望：** 数秒内 `Status` 变为 `Active`（实测约 2–10 秒）。

**期望响应示例（200）：**

```json
{
  "Id": "asset-20260701072414-w7q99",
  "Name": "asset-test",
  "AssetType": "Image",
  "GroupId": "group-20260701070716-hgk9l",
  "Status": "Active",
  "URL": "https://ark-media-asset.tos-cn-beijing.volces.com/...?X-Tos-Signature=...",
  "ProjectName": "maas",
  "CreateTime": "2026-06-30T23:24:14Z",
  "UpdateTime": "2026-06-30T23:24:15Z"
}
```

**轮询建议：** 间隔 2s，最多 30 次。终态：`Active` / `Failed` / `Deleted`。

> **注意 URL 的用途：** 该签名 URL 仅用于**预览/下载**。用于**图生视频**时，仅**非真人**图片可直接用它；**真人图片**必须改用 `asset://asset-xxxx` 引用（见 TC-13）。

---

### TC-04 · UpdateAsset

```bash
curl -sS -X POST '{HOST}/doubao/open/UpdateAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"Id":"{ASSET_ID}","Name":"renamed"}'
```

**期望响应（200）：** `{ "Id": "asset-..." }`

---

### TC-05 · ListAssets（更新后 + 筛选）

```bash
curl -sS -X POST '{HOST}/doubao/open/ListAssets' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"PageNumber":1,"PageSize":20,"Filter":{"Statuses":["Active"],"Name":"renamed"}}'
```

**期望（200）：** `Items` 中含该素材，`Name` 为 `renamed`，`TotalCount >= 1`。

---

### TC-06 · DeleteAsset

```bash
curl -sS -X POST '{HOST}/doubao/open/DeleteAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"Id":"{ASSET_ID}"}'
```

**期望响应（200）：** `{}`

---

### TC-07 · GetAsset（删除后）

```bash
curl -sS -X POST '{HOST}/doubao/open/GetAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"Id":"{ASSET_ID}"}'
```

**期望（502，上游已删除）：**

```json
{ "error": { "code": "VolcengineCallFailed",
  "message": "volcengine GetAsset: NotFound.asset_id: The specified asset ... is not found." } }
```

---

### TC-08 · GetAsset（缺少 Id）

```bash
curl -sS -X POST '{HOST}/doubao/open/GetAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**期望（400）：** `{ "error": "Id is required" }`

---

### TC-09 · GetAsset（不存在的 Id）

```bash
curl -sS -X POST '{HOST}/doubao/open/GetAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"Id":"asset-fake-nonexistent-id"}'
```

**期望（502，上游参数错误）：**

```json
{ "error": { "code": "VolcengineCallFailed",
  "message": "volcengine GetAsset: InvalidParameter.AssetID: Id is Invalid" } }
```

---

### TC-10 · ListAssetGroups(非管理员)

```bash
curl -sS -X POST '{HOST}/doubao/open/ListAssetGroups' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"PageNumber":1,"PageSize":5}'
```

**期望（403，普通用户令牌）：** `{ "error": "asset group management requires admin privileges" }`

---

### TC-11 · ListAssetGroups（管理员，可选）

使用**管理员用户**签发的令牌重复 TC-10。

**期望（200）：** 返回 `Items` / `TotalCount` 等分组列表（含各用户自动创建的 `newapi-user-*` 分组）。

---

### TC-12 · 非真人素材 URL 用于视频生成（可选联调）

在 TC-03 拿到 `Active` 状态的 `URL` 后（**仅适用于非真人图片**，如风景/物体）：

```bash
curl -sS -X POST '{HOST}/v1/video/generations' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "doubao-seedance-2.0",
    "prompt": "画面轻微晃动，自然光",
    "metadata": {
      "ratio": "adaptive",
      "duration": 5,
      "content": [
        { "type": "image_url", "image_url": { "url": "{ASSET_URL_FROM_GET_ASSET}" }, "role": "first_frame" }
      ]
    }
  }'
```

**期望（200）：** 返回 `id`（任务 ID），再按 [seedance-video-api.md](./seedance-video-api.md) 轮询与下载。

---

### TC-13 · 真人图片必须用 `asset://` 引用（重要）

真人图片直接传 URL 会被上游隐私检测拦截，**必须先注册素材再用 `asset://asset-xxxx` 引用**。本用例验证三种传法的差异。

**第一步：注册真人素材并轮询至 Active**

```bash
# 含真人的公网图片（高度 300~6000px）
curl -sS -X POST '{HOST}/doubao/open/CreateAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' -H 'Content-Type: application/json' \
  -d '{"URL":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800","AssetType":"Image","Name":"real-person-test"}'
# → { "Id": "asset-xxxx" }

curl -sS -X POST '{HOST}/doubao/open/GetAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' -H 'Content-Type: application/json' \
  -d '{"Id":"asset-xxxx"}'
# → Status: Active（记住 asset id，不要用它返回的 URL）
```

**第二步：三种传法对比**

```bash
# (A) 原始真人 URL —— 预期失败
curl -sS -X POST '{HOST}/v1/video/generations' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' -H 'Content-Type: application/json' \
  -d '{"model":"doubao-seedance-2.0","prompt":"人物缓缓转头","metadata":{"ratio":"adaptive","duration":5,"content":[{"type":"image_url","image_url":{"url":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800"},"role":"first_frame"}]}}'

# (B) GetAsset 返回的签名 TOS URL —— 预期同样失败
#     （把 {ASSET_SIGNED_URL} 换成 GetAsset 的 URL 字段）

# (C) asset:// 引用 —— 预期成功
curl -sS -X POST '{HOST}/v1/video/generations' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' -H 'Content-Type: application/json' \
  -d '{"model":"doubao-seedance-2.0","prompt":"人物缓缓转头，电影感打光","metadata":{"ratio":"adaptive","duration":5,"content":[{"type":"image_url","image_url":{"url":"asset://asset-xxxx"},"role":"first_frame"}]}}'
```

**期望结果：**

| 传法 | HTTP | 响应 |
| --- | --- | --- |
| (A) 原始真人 URL | 400 | `fail_to_fetch_task` 包裹 `InputImageSensitiveContentDetected.PrivacyInformation` |
| (B) 签名 TOS URL | 400 | 同上（**签名 URL 也不行**） |
| (C) `asset://asset-xxxx` | 200 | `{ "id": "task_...", "status": "queued" }`，随后正常生成至 `completed` |

> 要点：
> - `asset://` 引用只需素材 `Id`；网关会把该 URL 原样透传给上游。
> - 非真人图片直接传 URL 即可，无需 `asset://`。

---

## 4. 一键脚本

### 4.1 Bash（完整生命周期 TC-01 ~ TC-07）

```bash
#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-http://43.156.53.249:25873}"
TOKEN="${TOKEN:-sk-YOUR_TOKEN}"
AUTH="Authorization: Bearer ${TOKEN}"

post() {
  curl -sS -w "\n__HTTP__%{http_code}\n" -X POST "${HOST}/doubao/open/$1" \
    -H "${AUTH}" -H "Content-Type: application/json" -d "$2"
}

echo "=== TC-01 ListAssets ==="
post ListAssets '{"PageNumber":1,"PageSize":20}'

echo "=== TC-02 CreateAsset ==="
CREATE=$(post CreateAsset '{"URL":"https://picsum.photos/800/600.jpg","AssetType":"Image","Name":"asset-test"}')
echo "$CREATE"
ASSET_ID=$(echo "$CREATE" | sed -n 's/.*"Id":"\([^"]*\)".*/\1/p' | head -1)
[[ -z "$ASSET_ID" ]] && { echo "CreateAsset failed"; exit 1; }
echo "ASSET_ID=$ASSET_ID"

echo "=== TC-03 GetAsset (poll) ==="
for i in $(seq 1 30); do
  RESP=$(post GetAsset "{\"Id\":\"${ASSET_ID}\"}")
  echo "poll $i: $RESP"
  echo "$RESP" | grep -q '"Status":"Active"' && break
  echo "$RESP" | grep -q '"Status":"Failed"' && exit 1
  sleep 2
done

echo "=== TC-04 UpdateAsset ==="; post UpdateAsset "{\"Id\":\"${ASSET_ID}\",\"Name\":\"renamed\"}"
echo "=== TC-05 ListAssets ==="; post ListAssets '{"PageNumber":1,"PageSize":20,"Filter":{"Statuses":["Active"]}}'
echo "=== TC-06 DeleteAsset ==="; post DeleteAsset "{\"Id\":\"${ASSET_ID}\"}"
echo "=== TC-07 GetAsset after delete ==="; post GetAsset "{\"Id\":\"${ASSET_ID}\"}" || true
echo "=== TC-08 GetAsset no Id ==="; post GetAsset '{}' || true
echo "=== TC-10 ListAssetGroups (expect 403) ==="; post ListAssetGroups '{"PageNumber":1,"PageSize":5}' || true
echo "=== done ==="
```

用法：

```bash
export HOST=http://43.156.53.249:25873
export TOKEN=sk-YOUR_TOKEN
bash volc-asset-test.sh
```

### 4.2 Python（含真人 asset:// 全链路）

```python
#!/usr/bin/env python3
"""volc-asset 全链路复现：素材生命周期 + 真人 asset:// 图生视频"""
import os, sys, time, requests

HOST = os.environ.get("HOST", "http://43.156.53.249:25873")
TOKEN = os.environ.get("TOKEN", "sk-YOUR_TOKEN")
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
PERSON_URL = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800"


def asset(action, body):
    return requests.post(f"{HOST}/doubao/open/{action}", json=body, headers=H, timeout=120)


def submit_video(image_url):
    return requests.post(f"{HOST}/v1/video/generations", headers=H, timeout=120, json={
        "model": "doubao-seedance-2.0",
        "prompt": "the person slowly turns head and smiles, cinematic lighting",
        "metadata": {"ratio": "adaptive", "duration": 5,
                     "content": [{"type": "image_url", "image_url": {"url": image_url}, "role": "first_frame"}]},
    })


def main():
    # 1) 注册真人素材
    r = asset("CreateAsset", {"URL": PERSON_URL, "AssetType": "Image", "Name": "real-person-test"})
    print("CreateAsset:", r.status_code, r.text)
    r.raise_for_status()
    asset_id = r.json()["Id"]

    # 2) 轮询至 Active
    signed_url = None
    for _ in range(30):
        time.sleep(2)
        g = asset("GetAsset", {"Id": asset_id}).json()
        if g.get("Status") == "Active":
            signed_url = g.get("URL")
            break
    assert signed_url, "asset not Active"
    print("Active asset:", asset_id)

    # 3) 三种传法对比
    for label, url in [("raw person URL", PERSON_URL),
                       ("signed TOS URL", signed_url),
                       ("asset:// ref", f"asset://{asset_id}")]:
        s = submit_video(url)
        print(f"[{label}] {s.status_code}: {s.text[:200]}")
        if s.status_code == 200:
            task_id = s.json()["id"]
            for _ in range(30):
                time.sleep(8)
                q = requests.get(f"{HOST}/v1/videos/{task_id}", headers=H).json()
                print("   ", q.get("status"), q.get("progress"))
                if q.get("status") == "completed":
                    print("    video:", (q.get("metadata") or {}).get("url"))
                    break
                if q.get("status") == "failed":
                    print("    FAILED:", q.get("error"))
                    break


if __name__ == "__main__":
    main()
```

用法：

```bash
export HOST=http://43.156.53.249:25873
export TOKEN=sk-YOUR_TOKEN
python3 volc-asset-test.py
```

---

## 5. 实测记录（2026-07-01，`http://43.156.53.249:25873`，普通用户令牌）

### 素材生命周期

| 用例 | 结果 | 备注 |
| --- | --- | --- |
| TC-01 ListAssets | ✅ 200 | 初始 `TotalCount: 0` |
| TC-02 CreateAsset | ✅ 200 | 图片 `picsum.photos/800/600.jpg` |
| TC-03 GetAsset | ✅ 200 | 第 1 次轮询即 `Active` |
| TC-04 UpdateAsset | ✅ 200 | 返回 `{ "Id": "..." }` |
| TC-05 ListAssets | ✅ 200 | `Name` 已变为 `renamed` |
| TC-06 DeleteAsset | ✅ 200 | 响应 `{}` |
| TC-07 GetAsset 删除后 | ⚠️ 502 | 上游 `NotFound.asset_id` |
| TC-08 缺 Id | ✅ 400 | `Id is required` |
| TC-09 假 Id | ⚠️ 502 | 上游 `InvalidParameter.AssetID` |
| TC-10 ListAssetGroups | ✅ 403 | 非 admin 令牌，符合预期 |

### 真人图片（TC-13，素材 `asset-20260701142244-hvbd4`）

| 传法 | 结果 |
| --- | --- |
| (A) 原始真人 URL | ❌ 400 `InputImageSensitiveContentDetected.PrivacyInformation` |
| (B) 签名 TOS URL | ❌ 400 同上 |
| (C) `asset://asset-20260701142244-hvbd4` | ✅ 200 → `queued` → `in_progress` → **`completed`**，成功产出 mp4 |

**CreateAsset 失败样例（勿用）：**

| URL | 上游错误 |
| --- | --- |
| `https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream_example_image.png` | `DownloadFailed`（对象不存在） |
| `https://www.baidu.com/img/.../peak-result.png` | `HeightTooSmall`（高度 < 300px） |
| `https://thispersondoesnotexist.com/` | `UnsupportedImageFormat`（非直链图片） |
| `https://example.com/photo.png` | `DownloadFailed` |

---

## 6. 权限速查

| 接口 | 普通用户 | 管理员 |
| --- | --- | --- |
| `CreateAsset` / `ListAssets` / `GetAsset` / `UpdateAsset` / `DeleteAsset` | ✅ 仅本人素材 | ✅ 仅本人素材（不越权看他人） |
| `CreateAssetGroup` / `ListAssetGroups` / `GetAssetGroup` / `UpdateAssetGroup` / `DeleteAssetGroup` | ❌ 403 | ✅ |

详见 [volc-asset-api.md](./volc-asset-api.md) 第 2、6 节。
