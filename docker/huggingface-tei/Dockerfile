# Hugging Face TEI Docker镜像，预下载分词器和模型
FROM ghcr.io/huggingface/text-embeddings-inference:latest

# 设置环境变量
ENV HUGGINGFACE_HUB_CACHE=/data/cache
ENV TRANSFORMERS_CACHE=/data/cache
ENV HF_HOME=/data/cache
ENV TOKENIZERS_PARALLELISM=false
ENV HF_HUB_OFFLINE=1

# 创建缓存目录
USER root
RUN mkdir -p /data/cache && chown -R 1000:1000 /data

# 安装Python和必要的包来预下载模型
RUN apt-get update && apt-get install -y \
    python3 python3-pip curl wget git && \
    pip3 install --no-cache-dir \
    huggingface_hub transformers torch \
    tokenizers sentencepiece

# 创建预下载脚本
COPY preload_all_tokenizers.py /tmp/preload_all_tokenizers.py

# 预下载所有分词器（强制下载，确保本地可用）
RUN HF_HUB_OFFLINE=0 python3 /tmp/preload_all_tokenizers.py

# 创建分词器管理脚本
COPY tokenizer_manager.py /usr/local/bin/tokenizer_manager.py
RUN chmod +x /usr/local/bin/tokenizer_manager.py

# 验证分词器下载完成
RUN python3 -c "
import os
cache_dir = '/data/cache'
tokenizer_files = []
for root, dirs, files in os.walk(cache_dir):
    for file in files:
        if file in ['tokenizer.json', 'tokenizer_config.json', 'vocab.txt']:
            tokenizer_files.append(file)
print(f'Found {len(tokenizer_files)} tokenizer files')
if len(tokenizer_files) < 10:
    raise Exception('Not enough tokenizer files found')
"

# 清理临时文件但保留管理工具
RUN rm /tmp/preload_all_tokenizers.py && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 切换回原用户
USER 1000

# 暴露端口
EXPOSE 80

# 设置默认启动命令
ENTRYPOINT ["text-embeddings-inference"]
