# Hugging Face TEI Docker 部署指南

本目录包含用于部署 Hugging Face Text Embeddings Inference (TEI) 服务的 Docker 配置文件，特别针对重排序功能进行了优化。

## 特性

- 🚀 **预下载分词器**: 在构建时预先下载常用模型的分词器，避免运行时下载延迟
- 🔧 **多模型支持**: 支持多种重排序和嵌入模型
- 📦 **Docker Compose**: 提供完整的多服务部署配置
- 🛠️ **自动化构建**: 包含自动化构建和测试脚本
- 💾 **缓存优化**: 智能缓存管理，减少重复下载

## 文件说明

```
docker/huggingface-tei/
├── Dockerfile              # 主要的TEI镜像，包含预下载的模型
├── Dockerfile.preload      # 轻量级镜像，仅用于预下载分词器
├── download_models.py      # 完整模型下载脚本
├── preload_tokenizers.py   # 分词器预下载脚本
├── docker-compose.yml      # 多服务部署配置
├── build.sh               # 自动化构建脚本
└── README.md              # 本文件
```

## 快速开始

### 方法一：使用构建脚本（推荐）

```bash
# 进入目录
cd docker/huggingface-tei

# 运行构建脚本
./build.sh
```

### 方法二：手动构建

```bash
# 构建镜像
docker build -t huggingface-tei:latest .

# 启动单个服务
docker run --gpus all -p 8080:80 \
  -v $(pwd)/data:/data \
  huggingface-tei:latest \
  --model-id BAAI/bge-reranker-v2-m3
```

### 方法三：使用 Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

## 支持的模型

### 重排序模型
- `BAAI/bge-reranker-v2-m3` (多语言，推荐)
- `BAAI/bge-reranker-large`
- `BAAI/bge-reranker-base`
- `jinaai/jina-reranker-v2-base-multilingual`
- `jinaai/jina-reranker-v1-base-en`
- `cross-encoder/ms-marco-MiniLM-L-6-v2`
- `mixedbread-ai/mxbai-rerank-large-v1`

### 嵌入模型
- `sentence-transformers/all-MiniLM-L6-v2`
- `BAAI/bge-small-en-v1.5`
- `BAAI/bge-base-en-v1.5`
- `BAAI/bge-large-en-v1.5`

## 服务端口

Docker Compose 默认端口分配：

| 服务 | 端口 | 模型 | 用途 |
|------|------|------|------|
| bge-reranker-v2-m3 | 8080 | BAAI/bge-reranker-v2-m3 | 多语言重排序 |
| bge-reranker-base | 8081 | BAAI/bge-reranker-base | 基础重排序 |
| jina-reranker-v2 | 8082 | jinaai/jina-reranker-v2-base-multilingual | 多语言重排序 |
| embedding-minilm | 8083 | sentence-transformers/all-MiniLM-L6-v2 | 轻量级嵌入 |
| embedding-bge-small | 8084 | BAAI/bge-small-en-v1.5 | 小型嵌入 |

## API 测试

### 重排序 API

```bash
curl -X POST http://localhost:8080/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "机器学习的基本概念",
    "texts": [
      "机器学习是人工智能的一个分支",
      "深度学习使用神经网络",
      "自然语言处理专注于语言理解"
    ]
  }'
```

### 嵌入 API

```bash
curl -X POST http://localhost:8083/embed \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": ["Hello world", "你好世界"]
  }'
```

## 性能优化

### GPU 支持

确保安装了 NVIDIA Docker 支持：

```bash
# 安装 nvidia-docker2
sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# 验证 GPU 支持
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### 内存和并发设置

可以通过环境变量调整性能参数：

```bash
docker run --gpus all -p 8080:80 \
  -e MAX_CONCURRENT_REQUESTS=128 \
  -e MAX_BATCH_TOKENS=16384 \
  -e MAX_BATCH_REQUESTS=32 \
  huggingface-tei:latest \
  --model-id BAAI/bge-reranker-v2-m3
```

## 故障排除

### 常见问题

1. **构建时间过长**
   - 首次构建需要下载模型，可能需要 30-60 分钟
   - 使用 `Dockerfile.preload` 可以只下载分词器，减少构建时间

2. **GPU 内存不足**
   - 减少 `MAX_BATCH_TOKENS` 和 `MAX_BATCH_REQUESTS`
   - 使用较小的模型，如 `bge-reranker-base`

3. **网络连接问题**
   - 设置 HuggingFace 镜像：`export HF_ENDPOINT=https://hf-mirror.com`
   - 使用代理：`docker build --build-arg https_proxy=http://proxy:port`

### 日志调试

```bash
# 查看容器日志
docker logs <container_name>

# 实时查看日志
docker logs -f <container_name>

# 进入容器调试
docker exec -it <container_name> /bin/bash
```

## 高级配置

### 自定义模型

如果需要使用其他模型，可以修改 `download_models.py` 中的模型列表：

```python
RERANK_MODELS = [
    "your-custom/rerank-model",
    # ... 其他模型
]
```

### 持久化存储

建议将模型缓存挂载到持久化存储：

```bash
docker run --gpus all -p 8080:80 \
  -v /path/to/persistent/cache:/data \
  huggingface-tei:latest \
  --model-id BAAI/bge-reranker-v2-m3
```

## 监控和维护

### 健康检查

所有服务都配置了健康检查：

```bash
# 检查服务健康状态
curl http://localhost:8080/health
```

### 资源监控

```bash
# 查看容器资源使用
docker stats

# 查看 GPU 使用情况
nvidia-smi
```

## 更新和维护

### 更新模型

```bash
# 重新构建镜像以获取最新模型
docker build --no-cache -t huggingface-tei:latest .

# 重启服务
docker-compose down
docker-compose up -d
```

### 清理缓存

```bash
# 清理 Docker 缓存
docker system prune -a

# 清理模型缓存
rm -rf data/cache/*
```

## 许可证

本配置文件遵循 MIT 许可证。使用的模型请遵循各自的许可证要求。
