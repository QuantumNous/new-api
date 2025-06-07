#!/usr/bin/env python3
"""
专门用于预下载分词器的脚本
这个脚本只下载分词器文件，不下载完整的模型权重
"""

import os
import sys
from transformers import AutoTokenizer

# 设置缓存目录
cache_dir = "/cache"
os.makedirs(cache_dir, exist_ok=True)

# 需要预下载分词器的模型列表
MODELS = [
    # 重排序模型
    "BAAI/bge-reranker-v2-m3",
    "BAAI/bge-reranker-large", 
    "BAAI/bge-reranker-base",
    "jinaai/jina-reranker-v2-base-multilingual",
    "jinaai/jina-reranker-v1-base-en",
    "jinaai/jina-reranker-v1-turbo-en",
    "cross-encoder/ms-marco-MiniLM-L-6-v2",
    "cross-encoder/ms-marco-MiniLM-L-12-v2", 
    "cross-encoder/ms-marco-TinyBERT-L-2-v2",
    "mixedbread-ai/mxbai-rerank-large-v1",
    "mixedbread-ai/mxbai-rerank-base-v1",
    
    # 嵌入模型
    "sentence-transformers/all-MiniLM-L6-v2",
    "sentence-transformers/all-MiniLM-L12-v2",
    "sentence-transformers/all-mpnet-base-v2",
    "BAAI/bge-small-en-v1.5",
    "BAAI/bge-base-en-v1.5",
    "BAAI/bge-large-en-v1.5",
    "BAAI/bge-small-zh-v1.5",
    "BAAI/bge-base-zh-v1.5",
    "BAAI/bge-large-zh-v1.5",
]

def download_tokenizer(model_name):
    """下载指定模型的分词器"""
    print(f"正在下载分词器: {model_name}")
    
    try:
        # 只下载分词器，不下载模型权重
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=cache_dir,
            trust_remote_code=True,
            use_fast=True  # 优先使用fast tokenizer
        )
        
        # 验证分词器是否正常工作
        test_text = "Hello, world! 你好世界！"
        tokens = tokenizer.encode(test_text)
        decoded = tokenizer.decode(tokens)
        
        print(f"✓ 分词器下载成功: {model_name}")
        print(f"  测试文本: {test_text}")
        print(f"  Token数量: {len(tokens)}")
        return True
        
    except Exception as e:
        print(f"✗ 分词器下载失败 {model_name}: {e}")
        return False

def main():
    """主函数"""
    print("开始预下载分词器...")
    print(f"缓存目录: {cache_dir}")
    
    success_count = 0
    total_count = len(MODELS)
    
    for model in MODELS:
        if download_tokenizer(model):
            success_count += 1
        print()  # 空行分隔
    
    print(f"=== 下载完成 ===")
    print(f"成功: {success_count}/{total_count}")
    
    # 显示缓存目录内容
    print(f"\n缓存目录内容:")
    try:
        import subprocess
        result = subprocess.run(['find', cache_dir, '-name', '*.json', '-o', '-name', '*.txt'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            files = result.stdout.strip().split('\n')
            print(f"分词器文件数量: {len([f for f in files if f])}")
            
        # 显示缓存大小
        result = subprocess.run(['du', '-sh', cache_dir], capture_output=True, text=True)
        if result.returncode == 0:
            size = result.stdout.split()[0]
            print(f"缓存大小: {size}")
    except:
        pass
    
    if success_count < total_count:
        print("\n⚠ 部分分词器下载失败，但这不会影响TEI服务的正常运行")
        print("  失败的分词器将在首次使用时自动下载")
    else:
        print("\n✓ 所有分词器下载成功！")

if __name__ == "__main__":
    main()
