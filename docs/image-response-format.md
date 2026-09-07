# 图片 JSON 响应统一格式

适用于 OpenAI 兼容 Images API 的非流式生成和编辑响应，包括本站 OpenAI 类型的上游渠道。SSE 流式事件保持原协议，不转换为这个 JSON 结构。

成功响应的 `data` 必须是对象数组。保留图片 URL、Base64、usage 及未知上游扩展字段；固定补齐缺失的顶层 `created`、`size`、`output_format`、`quality`、`background`、`usage`，无法确定时为 JSON `null`。每张图片固定包含 `url`、`b64_json`、`revised_prompt` 和下列实际文件元数据：

```json
{
  "created": 1788777442,
  "data": [{
    "url": "https://example.com/image.png",
    "b64_json": null,
    "revised_prompt": null,
    "width": 1199,
    "height": 1312,
    "size": "1199x1312",
    "output_format": "png"
  }],
  "size": "1199x1312",
  "output_format": "png",
  "quality": null,
  "background": null,
  "usage": null
}
```

`data[i].width/height/size/output_format` 根据返回图片的文件头识别，优先处理 Base64，再尝试 URL，不使用请求中的期望尺寸代替实际尺寸。支持 PNG、JPEG、GIF、WebP。无法识别、访问失败或被访问策略阻止时，这四个字段返回 `null`，图片 URL/Base64 保留。它们仅描述文件头信息，不构成完整图片有效性验证。

顶层 `size` 和 `output_format` 保留上游已提供的值；上游缺少时，仅在全部图片的已识别元数据一致时推断，否则为 `null`。多张图片的实际尺寸以各自的 `data[i]` 字段为准。

URL 探测使用现有 SSRF 保护客户端、受控重定向和共享的 4 秒请求超时；每张图最多读取 512 KiB 文件头，不传递渠道 Key、用户认证头、Cookie 或重定向 Referer。仅探测最多 128 张图片，与请求图片数量上限一致；超出部分仍补齐空字段。超时或其他失败不使原图片响应失败。添加元数据不会改变模型调用计费，usage 的计费解析继续使用原始上游响应。

格式化后重新计算 Content-Length，删除原响应体校验头。非法 JSON、缺少有效 data 数组或非图片错误响应不会被伪装成成功图片响应。
