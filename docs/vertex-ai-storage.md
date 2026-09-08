# 如何通过 Vertex AI 渠道管理 Cloud Storage 文件

## 目标与边界

本指南面向需要让 Vertex AI Gemini 通过 `fileData.fileUri` 使用 Google Cloud Storage（GCS）文件的接入工程师。完成配置后，你可以使用 new-api 的固定 `/vertexai` 路由上传、列举、读取、下载和删除指定 bucket 中的对象。

这些路由只代理 GCS JSON API 的五组固定操作，不提供任意 Google API、任意主机或任意 URL 的通配代理，也不负责创建 bucket、修改 IAM、管理 ACL、复制或重写对象。授权粒度是整个 bucket，不支持只授权某个对象名前缀。

## 前置 IAM 与服务账号

1. 在 Google Cloud 项目中创建供 Vertex AI 渠道使用的服务账号。
2. 为服务账号授予调用 Vertex AI 所需的权限，例如 `roles/aiplatform.user`。
3. 在目标 bucket 上授予与实际操作匹配的 GCS 权限。需要完整执行本指南的上传、下载、列举和删除操作时，可授予 `roles/storage.objectUser`；生产环境应按最小权限原则拆分只读或只写权限。
4. 生成服务账号 JSON 密钥，并将完整 JSON 配置到 Vertex AI 渠道的 Key 中。

GCS 文件代理不支持 Vertex AI API Key 模式。不要把服务账号 JSON、私钥或网关 Token 写入源码、日志或公开文档。

## 配置渠道 bucket

在管理后台编辑 Vertex AI 渠道，在“存储桶”字段中填写允许访问的纯 bucket 名称，例如：

```text
example-bucket
archive-bucket-01
```

每个值必须只有 bucket 名称。不要填写 `gs://example-bucket`、`storage:gs:example-bucket`、`example-bucket/path` 或带查询字符串的值。保存后，系统会在渠道 `models` 中以 `storage:gs:<bucket>` 形式持久化授权；请求只能访问所选渠道精确配置的 bucket。

以下示例统一使用脱敏环境变量：

```bash
export NEW_API_BASE_URL="https://api.example.com"
export NEW_API_TOKEN="<your-new-api-token>"
export GCS_BUCKET="example-bucket"
export GCS_OBJECT="docs%2Freport.pdf"
```

## 使用五组固定路由

### 1. 使用 POST 上传对象

使用 media upload 将本地文件流式上传到指定对象名：

```bash
curl --fail-with-body \
  -X POST \
  -H "Authorization: Bearer ${NEW_API_TOKEN}" \
  -H "Content-Type: application/pdf" \
  --data-binary @./report.pdf \
  "${NEW_API_BASE_URL}/vertexai/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${GCS_OBJECT}"
```

此路由也支持 GCS 的 `multipart` 上传和 resumable 初始化。对象名中的 `/` 应编码为 `%2F`。

### 2. 使用 PUT 续传分块

先按“Resumable 上传”一节初始化会话，再对返回的网关 `Location` 发送分块：

```bash
curl --fail-with-body \
  -X PUT \
  -H "Authorization: Bearer ${NEW_API_TOKEN}" \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Range: bytes 0-1048575/2097152" \
  --data-binary @./chunk-000.bin \
  "${RESUMABLE_LOCATION}"
```

未完成时 GCS 通常返回 `308 Resume Incomplete`；最终分块完成后返回对象元数据。

### 3. 列举对象

使用 `prefix` 等 GCS 查询参数筛选列表：

```bash
curl --fail-with-body \
  -H "Authorization: Bearer ${NEW_API_TOKEN}" \
  "${NEW_API_BASE_URL}/vertexai/storage/v1/b/${GCS_BUCKET}/o?prefix=docs%2F"
```

渠道授权仍以整个 bucket 为单位，`prefix` 只筛选响应，不会缩小授权范围。

### 4. 读取元数据或下载对象

省略 `alt=media` 时读取对象元数据：

```bash
curl --fail-with-body \
  -H "Authorization: Bearer ${NEW_API_TOKEN}" \
  "${NEW_API_BASE_URL}/vertexai/storage/v1/b/${GCS_BUCKET}/o/${GCS_OBJECT}"
```

设置 `alt=media` 时流式下载对象内容：

```bash
curl --fail-with-body \
  -H "Authorization: Bearer ${NEW_API_TOKEN}" \
  -o ./downloaded-report.pdf \
  "${NEW_API_BASE_URL}/vertexai/storage/v1/b/${GCS_BUCKET}/o/${GCS_OBJECT}?alt=media"
```

需要断点下载时可增加 `Range: bytes=0-1048575`。网关会保留 GCS 的状态码、`Content-Range`、`ETag` 和响应体。

### 5. 删除对象

删除前确认对象名和 bucket，删除操作不可由网关恢复：

```bash
curl --fail-with-body \
  -X DELETE \
  -H "Authorization: Bearer ${NEW_API_TOKEN}" \
  "${NEW_API_BASE_URL}/vertexai/storage/v1/b/${GCS_BUCKET}/o/${GCS_OBJECT}"
```

## 在 `fileData.fileUri` 中引用对象

上传完成后，在 Vertex AI Gemini 请求中使用原始 GCS URI，而不是 `/vertexai` 网关下载地址：

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "fileData": {
            "mimeType": "application/pdf",
            "fileUri": "gs://example-bucket/docs/report.pdf"
          }
        },
        {
          "text": "请总结这份报告。"
        }
      ]
    }
  ]
}
```

执行推理的 Vertex AI 服务账号必须能够读取该对象。网关 Token 对 GCS 代理路由的访问权限不会替代 Google Cloud IAM。

## 使用 Resumable 上传

初始化 resumable 会话，并只从响应头读取 `Location`：

```bash
RESUMABLE_LOCATION="$({
  curl --silent --show-error --fail-with-body \
    -X POST \
    -D - \
    -o /dev/null \
    -H "Authorization: Bearer ${NEW_API_TOKEN}" \
    -H "Content-Type: application/json; charset=UTF-8" \
    -H "X-Upload-Content-Type: application/octet-stream" \
    --data "{\"name\":\"docs/report.pdf\"}" \
    "${NEW_API_BASE_URL}/vertexai/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=resumable"
} | awk 'tolower($1) == "location:" { sub(/\r$/, "", $2); print $2 }')"
```

返回的 `Location` 必须以 `${NEW_API_BASE_URL}/vertexai/` 开头。网关会校验 Google 返回的 session URL，并使用系统配置的服务地址安全改写；改写失败时返回 `502`，不会把 `storage.googleapis.com` session URL 暴露给客户端。后续每个 `PUT` 都会重新执行 Token 鉴权、限流、渠道分发和 bucket 授权。

## 常见错误与非计费说明

| 现象 | 常见原因 | 排查方式 |
| --- | --- | --- |
| `400 invalid_bucket` | bucket 包含路径、scheme、查询字符串或完整配置前缀 | 只传纯 bucket 名称 |
| `400 unsupported_key_type` | 渠道使用 Vertex AI API Key | 改用服务账号 JSON |
| `400 object_required` | 读取或删除路由缺少对象名 | 对完整对象名做 URL 编码后放入路径 |
| `403 bucket_not_allowed` | 所选渠道未精确配置目标 bucket | 检查渠道“存储桶”配置及 Token/用户组权限 |
| GCS `403` 响应 | 服务账号缺少 bucket IAM 权限 | 检查 bucket IAM 和服务账号身份 |
| `502 access_token_failed` | 服务账号 JSON、私钥、代理或 Google OAuth 异常 | 检查渠道凭证和 Proxy 配置，不要在日志中输出私钥 |
| `502 invalid_resumable_location` | 系统服务地址缺失，或 Google 返回的 session URL 未通过安全校验 | 配置正确的公开服务地址后重新初始化会话 |

这些 Storage Proxy 请求采用流式传输，不构造模型 RelayInfo，不执行 quota 预扣或结算，也不写模型消费日志。GCS 本身产生的存储、网络和请求费用仍由你的 Google Cloud 项目承担。

## 相关链接

- [Google Cloud Storage JSON API](https://cloud.google.com/storage/docs/json_api)
- [Cloud Storage IAM roles](https://cloud.google.com/storage/docs/access-control/iam-roles)
- [Resumable uploads](https://cloud.google.com/storage/docs/performing-resumable-uploads)
- [Vertex AI 文件输入](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/document-understanding)
