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

无论上游是否提供 `size`，顶层和每张图片的 `size` 都根据图片文件的实际宽高重新生成，覆盖上游的尺寸声明。单张图片或全部图片实测尺寸相同时，顶层返回该尺寸；多图尺寸不同或有图片无法读取时，顶层为 `null`，每张图片分别返回自己的实测尺寸。`output_format` 的顶层值保持兼容：保留上游已提供的值，缺失时根据全部图片一致的文件格式补充。

URL 探测使用现有 SSRF 保护客户端、受控重定向和共享的 4 秒请求超时；每张图最多读取 512 KiB 文件头，不传递渠道 Key、用户认证头、Cookie 或重定向 Referer。仅探测最多 128 张图片，与请求图片数量上限一致；超出部分仍补齐空字段。超时或其他失败不使原图片响应失败。添加元数据不会改变模型调用计费，usage 的计费解析继续使用原始上游响应。

格式化后重新计算 Content-Length，删除原响应体校验头。非法 JSON、缺少有效 data 数组或非图片错误响应不会被伪装成成功图片响应。

## 发布记录

2026-09-07 已部署至 `hardy777.top`，版本 `hardy-image-json-20260907-194257`，镜像 `hardy777/new-api:image-json-20260907-194257`。目标为 `140.245.89.202` / `a1-ubuntu-free` 的 ARM64 `new-api` 应用容器。本地功能提交 `d330e43554e94a10538840644d02e84f22d39945`；服务器源码提交 `2fc75de3a13d16a514ef44421ffa603f540db981`。

在禁止外网访问的隔离环境恢复生产 PostgreSQL，使用最终发布镜像和模拟图片上游，验证 Base64、URL、多图不同尺寸、URL 过期和已有元数据五种响应。基础字段齐全，实际尺寸来自 PNG 文件头，图片/扩展字段和 usage 保留，Content-Length 正确、旧 ETag 移除，原有 2 分单价扣费不变；未调用收费上游。

上线后公网状态返回新版本，容器 healthy、重启次数 0，生产运行镜像与隔离验收镜像一致。隔离容器和网络已清理。备份及切换前数据库恢复点：`/opt/new-api-releases/20260907-194257/backup`；回滚镜像：`hardy777/new-api:before-image-json-20260907-194257`。
