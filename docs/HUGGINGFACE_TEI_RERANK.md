# Hugging Face TEI 重排序功能

本文档介绍如何在 New API 中使用 Hugging Face TEI（Text Embeddings Inference）重排序功能。

## 功能概述

Hugging Face TEI 重排序功能允许您使用 Hugging Face 的文本嵌入推理服务来对文档进行重新排序，以提高搜索和检索的相关性。

## 支持的模型

以下是支持的重排序模型列表：

- `BAAI/bge-reranker-v2-m3`
- `BAAI/bge-reranker-large`
- `BAAI/bge-reranker-base`
- `jinaai/jina-reranker-v2-base-multilingual`
- `jinaai/jina-reranker-v1-base-en`
- `jinaai/jina-reranker-v1-turbo-en`
- `cross-encoder/ms-marco-MiniLM-L-6-v2`
- `cross-encoder/ms-marco-MiniLM-L-12-v2`
- `cross-encoder/ms-marco-TinyBERT-L-2-v2`
- `mixedbread-ai/mxbai-rerank-large-v1`
- `mixedbread-ai/mxbai-rerank-base-v1`
- `sentence-transformers/all-MiniLM-L6-v2`

## 配置步骤

### 1. 添加渠道

1. 登录 New API 管理界面
2. 进入"渠道管理"页面
3. 点击"添加新渠道"
4. 选择渠道类型为"Hugging Face TEI"
5. 填写以下信息：
   - **渠道名称**: 自定义名称
   - **Base URL**: TEI 服务的地址（例如：`http://localhost:8080`）
   - **API Key**: 如果需要认证，填写 API 密钥（可选）
   - **模型**: 选择或输入支持的模型名称

### 2. 配置模型映射

在"模型管理"页面中，您可以配置模型映射，将通用的模型名称映射到具体的 Hugging Face 模型。

## API 使用

### 重排序 API

使用标准的 OpenAI 兼容重排序 API：

```bash
curl -X POST "http://your-api-host/v1/rerank" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "BAAI/bge-reranker-v2-m3",
    "query": "What is the capital of France?",
    "documents": [
      "Paris is the capital of France.",
      "London is the capital of England.", 
      "Berlin is the capital of Germany."
    ],
    "top_n": 2,
    "return_documents": true
  }'
```

### 响应格式

```json
{
  "results": [
    {
      "index": 0,
      "relevance_score": 0.95,
      "document": "Paris is the capital of France."
    },
    {
      "index": 2,
      "relevance_score": 0.12,
      "document": "Berlin is the capital of Germany."
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "total_tokens": 25
  }
}
```

### 嵌入 API

同样支持文本嵌入功能：

```bash
curl -X POST "http://your-api-host/v1/embeddings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "sentence-transformers/all-MiniLM-L6-v2",
    "input": [
      "Hello world",
      "How are you?"
    ]
  }'
```

## TEI 服务部署

如果您需要部署自己的 TEI 服务，可以使用以下 Docker 命令：

```bash
# 部署重排序模型
docker run --gpus all -p 8080:80 \
  -v $PWD/data:/data \
  ghcr.io/huggingface/text-embeddings-inference:latest \
  --model-id BAAI/bge-reranker-v2-m3 \
  --revision refs/pr/4

# 部署嵌入模型  
docker run --gpus all -p 8081:80 \
  -v $PWD/data:/data \
  ghcr.io/huggingface/text-embeddings-inference:latest \
  --model-id sentence-transformers/all-MiniLM-L6-v2
```

## 注意事项

1. **模型兼容性**: 确保您选择的模型与 TEI 服务兼容
2. **性能考虑**: 重排序操作可能比较耗时，建议根据实际需求调整 `top_n` 参数
3. **文档格式**: 支持多种文档格式，包括字符串、包含 `text` 或 `content` 字段的对象
4. **认证**: 如果 TEI 服务需要认证，请确保正确配置 API 密钥

## 故障排除

### 常见问题

1. **连接失败**: 检查 Base URL 是否正确，TEI 服务是否正常运行
2. **模型不支持**: 确认模型名称正确，且 TEI 服务已加载该模型
3. **认证失败**: 检查 API 密钥是否正确配置

### 日志调试

启用调试模式可以查看详细的请求和响应日志：

```bash
export DEBUG=true
```

## 更多信息

- [Hugging Face TEI 官方文档](https://github.com/huggingface/text-embeddings-inference)
- [New API 项目地址](https://github.com/Calcium-Ion/new-api)
