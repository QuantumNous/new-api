#!/usr/bin/env python3
"""
强制预下载所有分词器脚本
确保所有分词器都下载到本地，支持离线使用
"""

import os
import sys
import json
from transformers import AutoTokenizer
from huggingface_hub import snapshot_download

# 设置缓存目录
cache_dir = "/data/cache"
os.makedirs(cache_dir, exist_ok=True)

# 完整的模型列表 - 包含所有支持的重排序和嵌入模型
ALL_MODELS = [
    # BGE 重排序模型
    "BAAI/bge-reranker-v2-m3",
    "BAAI/bge-reranker-large", 
    "BAAI/bge-reranker-base",
    "BAAI/bge-reranker-v2-gemma",
    "BAAI/bge-reranker-v2-minicpm-layerwise",
    
    # Jina 重排序模型
    "jinaai/jina-reranker-v2-base-multilingual",
    "jinaai/jina-reranker-v1-base-en",
    "jinaai/jina-reranker-v1-turbo-en",
    "jinaai/jina-reranker-v1-tiny-en",
    
    # Cross-encoder 重排序模型
    "cross-encoder/ms-marco-MiniLM-L-6-v2",
    "cross-encoder/ms-marco-MiniLM-L-12-v2", 
    "cross-encoder/ms-marco-TinyBERT-L-2-v2",
    "cross-encoder/ms-marco-electra-base",
    
    # Mixedbread AI 重排序模型
    "mixedbread-ai/mxbai-rerank-large-v1",
    "mixedbread-ai/mxbai-rerank-base-v1",
    "mixedbread-ai/mxbai-rerank-xsmall-v1",
    
    # Sentence Transformers 嵌入模型
    "sentence-transformers/all-MiniLM-L6-v2",
    "sentence-transformers/all-MiniLM-L12-v2",
    "sentence-transformers/all-mpnet-base-v2",
    "sentence-transformers/all-distilroberta-v1",
    "sentence-transformers/paraphrase-MiniLM-L6-v2",
    
    # BGE 嵌入模型 - 英文
    "BAAI/bge-small-en-v1.5",
    "BAAI/bge-base-en-v1.5",
    "BAAI/bge-large-en-v1.5",
    "BAAI/bge-m3",
    
    # BGE 嵌入模型 - 中文
    "BAAI/bge-small-zh-v1.5",
    "BAAI/bge-base-zh-v1.5",
    "BAAI/bge-large-zh-v1.5",
    
    # 其他流行的嵌入模型
    "thenlper/gte-small",
    "thenlper/gte-base",
    "thenlper/gte-large",
    "intfloat/e5-small-v2",
    "intfloat/e5-base-v2",
    "intfloat/e5-large-v2",
]

def force_download_tokenizer(model_name):
    """强制下载指定模型的分词器和相关文件"""
    print(f"🔄 强制下载模型: {model_name}")
    
    success = False
    
    try:
        # 方法1: 使用 snapshot_download 下载完整仓库
        print(f"  📦 下载完整模型仓库...")
        snapshot_download(
            repo_id=model_name,
            cache_dir=cache_dir,
            local_files_only=False,
            resume_download=True,
            force_download=False,  # 避免重复下载
            ignore_patterns=["*.bin", "*.safetensors", "pytorch_model.bin"]  # 跳过大的权重文件
        )
        
        # 方法2: 专门下载分词器
        print(f"  🔤 下载分词器...")
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=cache_dir,
            trust_remote_code=True,
            use_fast=True,
            local_files_only=False,
            force_download=False
        )
        
        # 验证分词器工作正常
        test_texts = [
            "Hello, world!",
            "你好世界！",
            "This is a test sentence for tokenization.",
            "机器学习是人工智能的一个重要分支。"
        ]
        
        for test_text in test_texts:
            try:
                tokens = tokenizer.encode(test_text, add_special_tokens=True)
                decoded = tokenizer.decode(tokens, skip_special_tokens=True)
                if len(tokens) > 0:
                    print(f"  ✅ 分词器测试通过: '{test_text}' -> {len(tokens)} tokens")
                    success = True
                    break
            except Exception as e:
                print(f"  ⚠️  分词器测试失败: {e}")
                continue
        
        if success:
            print(f"  ✅ 模型下载成功: {model_name}")
        else:
            print(f"  ❌ 分词器验证失败: {model_name}")
            
    except Exception as e:
        print(f"  ❌ 模型下载失败 {model_name}: {e}")
        success = False
    
    return success

def verify_cache_structure():
    """验证缓存目录结构"""
    print(f"\n📁 验证缓存目录结构: {cache_dir}")
    
    total_files = 0
    tokenizer_files = 0
    config_files = 0
    
    for root, dirs, files in os.walk(cache_dir):
        for file in files:
            total_files += 1
            if file in ['tokenizer.json', 'tokenizer_config.json', 'vocab.txt', 'vocab.json']:
                tokenizer_files += 1
            elif file in ['config.json', 'tokenizer_config.json']:
                config_files += 1
    
    print(f"  📊 总文件数: {total_files}")
    print(f"  🔤 分词器文件数: {tokenizer_files}")
    print(f"  ⚙️  配置文件数: {config_files}")
    
    return tokenizer_files > 0

def create_offline_config():
    """创建离线使用配置"""
    config_file = os.path.join(cache_dir, "offline_config.json")
    
    config = {
        "offline_mode": True,
        "cache_dir": cache_dir,
        "downloaded_models": [],
        "download_timestamp": None
    }
    
    # 记录已下载的模型
    for model in ALL_MODELS:
        model_cache_path = os.path.join(cache_dir, f"models--{model.replace('/', '--')}")
        if os.path.exists(model_cache_path):
            config["downloaded_models"].append(model)
    
    import time
    config["download_timestamp"] = time.time()
    
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print(f"  📝 离线配置已保存: {config_file}")
    print(f"  📦 已下载模型数: {len(config['downloaded_models'])}")

def main():
    """主函数"""
    print("🚀 开始强制预下载所有分词器...")
    print(f"📁 缓存目录: {cache_dir}")
    print(f"📋 模型总数: {len(ALL_MODELS)}")
    
    success_count = 0
    failed_models = []
    
    for i, model in enumerate(ALL_MODELS, 1):
        print(f"\n[{i}/{len(ALL_MODELS)}] 处理模型: {model}")
        
        if force_download_tokenizer(model):
            success_count += 1
        else:
            failed_models.append(model)
    
    print(f"\n🎯 下载完成统计:")
    print(f"  ✅ 成功: {success_count}/{len(ALL_MODELS)}")
    print(f"  ❌ 失败: {len(failed_models)}")
    
    if failed_models:
        print(f"\n❌ 失败的模型:")
        for model in failed_models:
            print(f"  - {model}")
    
    # 验证缓存结构
    if verify_cache_structure():
        print(f"\n✅ 缓存验证通过")
    else:
        print(f"\n❌ 缓存验证失败")
        sys.exit(1)
    
    # 创建离线配置
    create_offline_config()
    
    # 设置权限
    os.system(f"chown -R 1000:1000 {cache_dir}")
    
    print(f"\n🎉 所有分词器预下载完成！")
    print(f"💡 提示: 容器现在可以在离线模式下运行")
    
    if success_count < len(ALL_MODELS) * 0.8:  # 如果成功率低于80%
        print(f"⚠️  警告: 成功率较低 ({success_count/len(ALL_MODELS)*100:.1f}%)")
        print(f"   这可能会影响某些模型的使用")

if __name__ == "__main__":
    main()
