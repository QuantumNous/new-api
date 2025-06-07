# Hugging Face TEI 重排序功能部署指南

本指南详细介绍如何部署和配置 Hugging Face TEI 重排序功能，包括分词器预下载和 Docker 构建。

## 目录

1. [环境准备](#环境准备)
2. [分词器预下载](#分词器预下载)
3. [Docker 部署](#docker-部署)
4. [New API 配置](#new-api-配置)
5. [测试验证](#测试验证)
6. [故障排除](#故障排除)

## 环境准备

### 系统要求

- **操作系统**: Linux (推荐 Ubuntu 20.04+)
- **内存**: 最少 8GB，推荐 16GB+
- **存储**: 最少 50GB 可用空间（用于模型缓存）
- **GPU**: 可选，但强烈推荐（NVIDIA GPU with CUDA 11.0+）

### 软件依赖

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 安装 NVIDIA Docker (如果有 GPU)
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

## 分词器预下载

### 方法一：使用预构建脚本

```bash
# 进入项目目录
cd docker/huggingface-tei

# 运行预下载脚本
python3 preload_tokenizers.py
```

### 方法二：使用 Docker 预下载

```bash
# 构建预下载镜像
docker build -f Dockerfile.preload -t tokenizer-preloader .

# 运行预下载容器
docker run --rm -v $(pwd)/cache:/cache tokenizer-preloader

# 检查下载的文件
ls -la cache/
```

### 方法三：手动下载

```python
from transformers import AutoTokenizer

models = [
    "BAAI/bge-reranker-v2-m3",
    "BAAI/bge-reranker-base",
    "jinaai/jina-reranker-v2-base-multilingual"
]

for model in models:
    print(f"下载 {model}...")
    tokenizer = AutoTokenizer.from_pretrained(
        model, 
        cache_dir="./cache",
        trust_remote_code=True
    )
    print(f"✓ {model} 下载完成")
```

## Docker 部署

### 单服务部署

```bash
# 基础重排序服务
docker run --gpus all -d \
  --name tei-reranker \
  -p 8080:80 \
  -v $(pwd)/data:/data \
  -e HUGGINGFACE_HUB_CACHE=/data/cache \
  ghcr.io/huggingface/text-embeddings-inference:latest \
  --model-id BAAI/bge-reranker-v2-m3 \
  --max-concurrent-requests 128 \
  --max-batch-tokens 16384

# 检查服务状态
docker logs tei-reranker
curl http://localhost:8080/health
```

### 多服务部署

```bash
# 使用 Docker Compose
cd docker/huggingface-tei
docker-compose up -d

# 查看所有服务状态
docker-compose ps

# 查看特定服务日志
docker-compose logs -f bge-reranker-v2-m3
```

### 自定义构建

```bash
# 构建包含预下载分词器的镜像
cd docker/huggingface-tei
./build.sh

# 使用自定义镜像
docker run --gpus all -d \
  --name custom-tei \
  -p 8080:80 \
  -v $(pwd)/data:/data \
  huggingface-tei:latest \
  --model-id BAAI/bge-reranker-v2-m3
```

## New API 配置

### 1. 添加渠道

在 New API 管理界面中：

1. 进入"渠道管理"页面
2. 点击"添加新渠道"
3. 填写配置：

```json
{
  "name": "HuggingFace TEI Rerank",
  "type": 50,
  "base_url": "http://localhost:8080",
  "api_key": "",
  "models": "BAAI/bge-reranker-v2-m3,BAAI/bge-reranker-base",
  "status": 1,
  "priority": 0,
  "weight": 1
}
```

### 2. 配置模型映射

```json
{
  "bge-reranker-v2-m3": "BAAI/bge-reranker-v2-m3",
  "bge-reranker-base": "BAAI/bge-reranker-base",
  "jina-reranker-v2": "jinaai/jina-reranker-v2-base-multilingual"
}
```

### 3. 环境变量配置

```bash
# New API 配置
export CHANNEL_UPDATE_FREQUENCY=10
export CHANNEL_TEST_FREQUENCY=60

# 调试模式
export DEBUG=true
export LOG_LEVEL=debug
```

## 测试验证

### 自动化测试

```bash
# 运行集成测试
./test/integration_test.sh

# 运行单元测试
go test ./test/huggingface_tei_test.go -v
```

### 手动测试

#### 1. 健康检查

```bash
curl http://localhost:8080/health
```

#### 2. 重排序测试

```bash
curl -X POST http://localhost:8080/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "机器学习的基本概念",
    "texts": [
      "机器学习是人工智能的一个分支，它使计算机能够在没有明确编程的情况下学习。",
      "深度学习是机器学习的一个子集，使用神经网络来模拟人脑的工作方式。",
      "自然语言处理是计算机科学和人工智能的一个分支。"
    ]
  }'
```

#### 3. 通过 New API 测试

```bash
curl -X POST http://your-new-api-host/v1/rerank \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "bge-reranker-v2-m3",
    "query": "What is machine learning?",
    "documents": [
      "Machine learning is a subset of artificial intelligence.",
      "Deep learning uses neural networks.",
      "Natural language processing focuses on language understanding."
    ],
    "top_n": 2,
    "return_documents": true
  }'
```

## 性能优化

### GPU 配置

```bash
# 检查 GPU 可用性
nvidia-smi

# 多 GPU 部署
docker run --gpus '"device=0,1"' -d \
  --name tei-multi-gpu \
  -p 8080:80 \
  huggingface-tei:latest \
  --model-id BAAI/bge-reranker-v2-m3
```

### 内存优化

```bash
# 限制容器内存使用
docker run --gpus all -d \
  --memory=8g \
  --memory-swap=16g \
  --name tei-memory-limited \
  -p 8080:80 \
  huggingface-tei:latest \
  --model-id BAAI/bge-reranker-base \
  --max-batch-tokens 8192
```

### 并发优化

```bash
# 高并发配置
docker run --gpus all -d \
  --name tei-high-concurrency \
  -p 8080:80 \
  huggingface-tei:latest \
  --model-id BAAI/bge-reranker-v2-m3 \
  --max-concurrent-requests 256 \
  --max-batch-tokens 32768 \
  --max-batch-requests 64
```

## 故障排除

### 常见问题

#### 1. 模型下载失败

```bash
# 设置镜像源
export HF_ENDPOINT=https://hf-mirror.com

# 手动下载模型
huggingface-cli download BAAI/bge-reranker-v2-m3 --cache-dir ./cache
```

#### 2. GPU 内存不足

```bash
# 使用较小的模型
docker run --gpus all -d \
  --name tei-small \
  -p 8080:80 \
  huggingface-tei:latest \
  --model-id BAAI/bge-reranker-base \
  --max-batch-tokens 4096
```

#### 3. 服务启动慢

```bash
# 检查容器日志
docker logs -f tei-reranker

# 检查资源使用
docker stats tei-reranker
```

### 日志分析

```bash
# 查看详细日志
docker logs --details tei-reranker

# 实时监控
docker logs -f --tail 100 tei-reranker

# 导出日志
docker logs tei-reranker > tei.log 2>&1
```

### 性能监控

```bash
# 监控 GPU 使用
watch -n 1 nvidia-smi

# 监控容器资源
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# API 性能测试
ab -n 100 -c 10 -T application/json -p test_data.json http://localhost:8080/rerank
```

## 生产环境建议

### 1. 高可用部署

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  tei-reranker-1:
    image: huggingface-tei:latest
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
        max_attempts: 3
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - tei-reranker-1
```

### 2. 监控和告警

```bash
# 使用 Prometheus 监控
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  prom/prometheus

# 配置健康检查告警
curl -X POST http://your-alertmanager/api/v1/alerts \
  -d '{"alerts": [{"labels": {"service": "tei-reranker"}}]}'
```

### 3. 备份和恢复

```bash
# 备份模型缓存
tar -czf tei-cache-backup.tar.gz data/cache/

# 恢复模型缓存
tar -xzf tei-cache-backup.tar.gz
```

这个部署指南涵盖了从环境准备到生产部署的完整流程，确保 Hugging Face TEI 重排序功能能够稳定运行。
