# 性能优化记录

> 日期：2026-03-29  
> 分支：m-chen  
> 作者：陈明

---

## 1. Mermaid 图表库懒加载

**问题**：`mermaid` 库（~5MB）在首屏同步加载，导致初始 JS bundle 达到 7.2MB（gzip 后 1.9MB），严重拖慢首屏渲染。

**原因**：`MarkdownRenderer.jsx` 顶部 `import mermaid from 'mermaid'` 将整个库打入主 chunk，但 mermaid 只在聊天页面渲染流程图时才用到。

**修改文件**：`web/src/components/common/markdown/MarkdownRenderer.jsx`

**方案**：
- 移除顶层 `import mermaid from 'mermaid'`
- 改为动态 `import('mermaid')`，首次使用时才加载
- 用模块级变量 `mermaidInstance` 缓存实例，避免重复加载
- `mermaid.initialize()` 延迟到首次 import 后执行

```javascript
// Before (同步加载，阻塞首屏)
import mermaid from 'mermaid';
mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

// After (按需加载，首屏零开销)
let mermaidInstance = null;
const getMermaid = async () => {
  if (!mermaidInstance) {
    const m = await import('mermaid');
    mermaidInstance = m.default;
    mermaidInstance.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
  }
  return mermaidInstance;
};
```

**效果**：首屏 JS 减少约 5MB，mermaid 相关代码被 Vite 自动拆分为独立 chunk，仅在需要渲染流程图时异步加载。

---

## 2. 非流式 Relay 端点 Gzip 压缩

**问题**：Relay 路由（`/v1/*`）没有启用 gzip 压缩，模型列表等 JSON 响应体积较大时传输慢。

**原因**：`main.go` 中全局 gzip 被注释掉（因为会破坏 SSE 流式响应），但非流式端点也因此失去了压缩。

**修改文件**：`router/relay-router.go`

**方案**：对确定不会返回 SSE 的端点单独启用 gzip：
- `/v1/models` — 模型列表（纯 JSON）
- `/v1beta/models` — Gemini 模型列表
- `/v1beta/openai/models` — Gemini 兼容模型列表

```go
modelsRouter := router.Group("/v1/models")
modelsRouter.Use(middleware.RouteTag("relay"))
modelsRouter.Use(gzip.Gzip(gzip.DefaultCompression))  // 新增
modelsRouter.Use(middleware.TokenAuth())
```

**注意**：Chat Completions、Messages、Responses 等可能返回 SSE 的端点不加 gzip，避免流式响应被缓冲。

**效果**：模型列表等 JSON 响应体积减少 60-80%。

---

## 3. Nginx 反向代理配置

**问题**：Go 服务直接处理所有请求（静态资源 + API + 流式响应），没有专门的静态资源缓存层。

**配置文件**：`deploy/nginx.conf`

**方案**：在 Go 服务前加一层 Nginx，职责分离：

| 请求类型 | Nginx 处理 | 说明 |
|---------|-----------|------|
| `/assets/*` | 365 天缓存 + immutable | Vite 构建产物含 hash，可永久缓存 |
| 静态文件（ico/png/svg/font） | 7 天缓存 | logo、favicon 等 |
| SSE 流式（chat/completions 等） | proxy_buffering off | 关闭缓冲，实时透传 |
| WebSocket（/v1/realtime） | Upgrade 头透传 | 实时语音 API |
| API 请求 | 正常代理 | 60s 超时 |
| 其他 | 正常代理 + 缓冲 | 120s 超时 |

**关键配置**：
- 全局 gzip（level 5，覆盖 JS/CSS/JSON/SVG/WOFF2）
- `keepalive 64` 保持与后端的长连接
- SSE 端点 `proxy_buffering off` + `proxy_cache off`
- WebSocket `proxy_read_timeout 86400s`（24 小时）

**部署方式**：
```bash
# 复制配置
cp deploy/nginx.conf /etc/nginx/conf.d/openapi.conf

# 修改 server_name 为你的域名
sed -i 's/your-domain.com/api.example.com/' /etc/nginx/conf.d/openapi.conf

# 测试并重载
nginx -t && nginx -s reload
```

**效果**：
- 静态资源命中缓存后零延迟（浏览器本地缓存）
- 首次加载通过 Nginx gzip 压缩减少 60-80% 传输量
- HTTP/2 多路复用（启用 HTTPS 后自动生效）
- Go 服务只处理动态请求，减轻负载

---

## 后续可优化项

以下优化项已识别但尚未实施，供后续开发参考：

1. **Semi UI Tree-shaking** — 当前整包打入 1.8MB，可通过 babel-plugin-import 按需引入
2. **@lobehub/icons 按需引入** — 仅在使用的页面 import 具体图标
3. **Pricing 缓存延长** — `model/pricing.go` 中缓存从 1 分钟延长到 5 分钟
4. **SQLite 连接池调优** — 默认 MaxOpenConns=1000 对 SQLite 过大，建议改为 1-2
5. **HTTP Transport IdleConnTimeout** — `service/http_client.go` 添加 `IdleConnTimeout: 90 * time.Second`
6. **Docker 镜像瘦身** — 最终阶段从 debian 换为 alpine 或 distroless
