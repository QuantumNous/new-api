# gpt-image-2 模型高错误率排查报告

> 日期: 2026-06-05 | 作者: AI 排查 | 分支: `fix/gpt-image-2-image-relay-multipart`

## 概述

用户 **kaopuapi**（userId=277）的 gpt-image-2 模型使用错误率居高不下，在最新日志中达到 **93.1%**（130 次调用，121 次报错）。经过对生产环境 (aiapi114.com) 的日志进行深入排查，确认错误原因分为以下三类。

---

## 错误分布

| 错误类型 | 占比 | userId | token | 根因 |
|----------|------|--------|-------|------|
| safety_violations=[sexual] | ~70% | 277 | kpc, kpc2~5 | 用户 prompt 触发 Azure 内容安全过滤 |
| Invalid image file or mode | ~20% | 277 | kpc3, kpc4, kpc5 | **平台 bug: multipart 字段名使用 `image[]`** |
| No available channel | ~5% | 334 | — | GPT 中转分组下无可用的 gpt-image-2 通道 |
| Timeout / DB 错误 | ~5% | 1, 277 | test, kpc | 上游超时或数据库 JSON 异常 |

---

## 错误一：Azure 安全过滤拦截

**表现**: `status_code=400, Your request was rejected by the safety system, safety_violations=[sexual]`

**根因**: 用户（userId=277）提交的 prompt 内容持续触发 Azure OpenAI 的内容安全过滤器。所有 kpc 系列 token（5 个不同的 token）均受影响，5 条 Azure 通道（29/30/31/32/33）全部返回相同错误。

**判定**: 用户侧问题。需要用户调整 prompt 内容，或申请 Azure 安全过滤豁免。

---

## 错误二：Invalid image file or mode（平台 bug，已修复）

### 错误表现

```
status_code=400
Invalid image file or mode for image 1 (或 image 3),
please check your image file.
```

### 跨版本时间线

| 时间 | 版本 | 通道 | multipart 格式 | 结果 |
|------|------|------|---------------|------|
| May 25 17:17 | v1.1.2 gray | chan 32 (Azure) | `files=[image(image_0.jpg)]` | ✅ 正常 |
| May 25 17:20 | v1.1.2 gray | chan 29 (Azure) | `files=[image(image_0.png)]` | ✅ 正常 |
| May 25 17:25 | v1.1.2 gray | chan 31 (Azure) | `files=[image(image_0.png)]` | ✅ 正常 |
| **May 27 13:47** | v1.1.2 gray (hotfix后) | chan 30-33 (Azure) | — | ❌ Invalid image for image 1 |
| May 28 09:03 | v1.1.2 release-3005 | chan 31 (Azure) | `files=[image[](image_0.jpg)]` | ❌ Invalid image for image 1 |
| June 5 11:22 | v1.1.3 gray-3008 | chan 29 (Azure) | `files=[image[](image_0.png)]` | ❌ Invalid image for image 3 |

### 根本原因

**代码位置**: `relay/channel/openai/adaptor.go` 第 484-494 行的 `ConvertImageRequest()` 方法

```go
// Bug: 当多张图片时使用 image[] 作为字段名
fieldName := "image"
if len(imageFiles) > 1 {
    fieldName = "image[]"
}
```

Azure DALL-E `/images/edits` API 要求的 multipart 字段是 `image`（字面值），不接受 PHP 数组风格 `image[]`。该 bug 在 **v1.1.2 中期的一次 hotfix 中引入**（May 25-27 之间），并延续到 v1.1.3。

### 判定

| 维度 | 结论 |
|------|------|
| 用户侧错误 | ❌ 排除。image/generations 正常，网络/鉴权无问题 |
| Azure 上游问题 | ❌ 排除。4 个不同 Azure region 全部同样报错 |
| **平台中转 bug** | ✅ **确认** |

### 修复

**分支**: `fix/gpt-image-2-image-relay-multipart`（基于 main）

**修改内容**: 移除 `image[]` 条件分支，始终使用 `image` 作为 multipart 文件字段名。

```diff
- fieldName := "image"
- if len(imageFiles) > 1 {
-     fieldName = "image[]"
- }
+ // Azure DALL-E /images/edits API only accepts "image" (singular),
+ // not "image[]" (PHP array notation).
+ fieldName := "image"
```

### 关于多参考图兼容性

Azure DALL-E `/images/edits` API 仅接受 **1 张底图 (`image`) + 1 张可选 mask (`mask`)**，不支持通过 multipart 字段传递多张参考图。用户在 prompt 中通过 `@reference.png` 方式引用的多张参考图，由上游模型自行处理。将 `image[]` 改为 `image` 不会影响多参考图功能——v1.1.2 早期版本（May 25 之前）始终使用 `image` 且功能正常。

---

## 错误三：通道不可用

**表现**: `No available channel for model gpt-image-2 under group GPT 中转渠道 (distributor)`

**根因**: userId=334 所属的 GPT 中转渠道分组下所有通道均不可用或未配置。需要检查分组下的 Azure 通道状态和配额。

---

## 建议措施

1. **已修复**: 将 `image[]` 改为 `image`，部署后 images/edits 错误率预计下降至接近 0%
2. **用户侧跟进**: 联系 userId=277 调整 prompt 内容合规性（safety_violations 占 70%）
3. **通道配置**: 检查 GPT 中转渠道分组下 userId=334 的通道可用性
4. **监控**: 部署修复后持续监控 gpt-image-2 的 images/edits 成功率

## 环境信息

- 服务器: ECS `i-j6c1whee07d0emzz8yxz` (43.99.6.151), cn-hongkong
- 服务: aiapi114.com (OneAPI fork), Docker 部署
- 当前版本: v1.1.3-fix5 (gray-3008), v1.1.2 (gray-3007 回滚备机)
- 数据库: PostgreSQL 15, Redis
- 上游: Azure OpenAI (Sweden Central, UAE North, West US 3, East US 2, Poland Central)
