# Cohere 渠道

渠道 Base URL 填 Cohere API 根地址（默认 `https://api.cohere.com`，不要附加 `/v2` 或 `/compatibility/v1`）。

- OpenAI 格式：`POST /v1/chat/completions`、`/v1/embeddings`、`/v1/rerank` 分别转换至 Cohere `/v2/chat`、`/v2/embed`、`/v2/rerank`；`POST /v1/responses` 通过 Chat 转换兼容（流式工具调用请改用 `/v1/chat/completions`）。
- 原生格式：`POST /v2/chat`、`/v2/embed`、`/v2/rerank` 保留原始 JSON 参数和查询串、原样返回响应（仅 Chat 支持 SSE）；仅路由至 Cohere 渠道，仍受令牌权限、模型映射、计费和渠道参数覆盖约束。
- OpenAI Embedding 默认使用 `input_type=search_document`；检索查询请显式传 `input_type=search_query`。图片/混合 Embedding 及 Cohere 专有 Chat 参数请使用 `/v2/*` 原生入口。

原生与 OpenAI 格式各自有不同请求体；渠道“透传请求体”开关不会将 `/v1/*` 请求变为 Cohere 原生格式。官方参考：[Chat](https://docs.cohere.com/reference/chat)、[Embed](https://docs.cohere.com/reference/embed)、[Rerank](https://docs.cohere.com/reference/rerank)。
