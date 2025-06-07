#!/usr/bin/env python3
"""
分词器管理工具
用于更新、验证和管理本地分词器缓存
"""

import os
import sys
import json
import argparse
import time
from transformers import AutoTokenizer
from huggingface_hub import snapshot_download

# 缓存目录
CACHE_DIR = "/data/cache"
CONFIG_FILE = os.path.join(CACHE_DIR, "offline_config.json")

def load_config():
    """加载离线配置"""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"downloaded_models": [], "download_timestamp": None}

def save_config(config):
    """保存离线配置"""
    config["download_timestamp"] = time.time()
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

def list_models():
    """列出已下载的模型"""
    config = load_config()
    print(f"📦 已下载的模型 ({len(config['downloaded_models'])} 个):")
    
    for model in sorted(config['downloaded_models']):
        model_path = os.path.join(CACHE_DIR, f"models--{model.replace('/', '--')}")
        if os.path.exists(model_path):
            size = get_dir_size(model_path)
            print(f"  ✅ {model} ({format_size(size)})")
        else:
            print(f"  ❌ {model} (缓存丢失)")
    
    if config.get("download_timestamp"):
        download_time = time.strftime("%Y-%m-%d %H:%M:%S", 
                                    time.localtime(config["download_timestamp"]))
        print(f"\n🕒 最后更新时间: {download_time}")

def get_dir_size(path):
    """获取目录大小"""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if os.path.exists(filepath):
                total_size += os.path.getsize(filepath)
    return total_size

def format_size(size_bytes):
    """格式化文件大小"""
    if size_bytes == 0:
        return "0B"
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.1f}{size_names[i]}"

def update_model(model_name):
    """更新指定模型的分词器"""
    print(f"🔄 更新模型: {model_name}")
    
    try:
        # 强制重新下载
        snapshot_download(
            repo_id=model_name,
            cache_dir=CACHE_DIR,
            local_files_only=False,
            resume_download=True,
            force_download=True,  # 强制重新下载
            ignore_patterns=["*.bin", "*.safetensors", "pytorch_model.bin"]
        )
        
        # 验证分词器
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=CACHE_DIR,
            trust_remote_code=True,
            local_files_only=False,
            force_download=True
        )
        
        # 测试分词器
        test_text = "Hello, world! 你好世界！"
        tokens = tokenizer.encode(test_text)
        decoded = tokenizer.decode(tokens)
        
        print(f"  ✅ 更新成功: {model_name}")
        print(f"  🔤 测试通过: '{test_text}' -> {len(tokens)} tokens")
        
        # 更新配置
        config = load_config()
        if model_name not in config["downloaded_models"]:
            config["downloaded_models"].append(model_name)
        save_config(config)
        
        return True
        
    except Exception as e:
        print(f"  ❌ 更新失败: {e}")
        return False

def update_all():
    """更新所有已下载的模型"""
    config = load_config()
    models = config.get("downloaded_models", [])
    
    if not models:
        print("❌ 没有找到已下载的模型")
        return
    
    print(f"🔄 开始更新 {len(models)} 个模型...")
    
    success_count = 0
    for i, model in enumerate(models, 1):
        print(f"\n[{i}/{len(models)}] 更新: {model}")
        if update_model(model):
            success_count += 1
    
    print(f"\n✅ 更新完成: {success_count}/{len(models)} 成功")

def verify_cache():
    """验证缓存完整性"""
    print("🔍 验证缓存完整性...")
    
    config = load_config()
    models = config.get("downloaded_models", [])
    
    valid_count = 0
    invalid_models = []
    
    for model in models:
        model_path = os.path.join(CACHE_DIR, f"models--{model.replace('/', '--')}")
        
        if not os.path.exists(model_path):
            print(f"  ❌ 缓存丢失: {model}")
            invalid_models.append(model)
            continue
        
        try:
            # 尝试加载分词器
            tokenizer = AutoTokenizer.from_pretrained(
                model,
                cache_dir=CACHE_DIR,
                local_files_only=True,
                trust_remote_code=True
            )
            
            # 简单测试
            tokens = tokenizer.encode("test")
            if len(tokens) > 0:
                print(f"  ✅ 验证通过: {model}")
                valid_count += 1
            else:
                print(f"  ❌ 分词器异常: {model}")
                invalid_models.append(model)
                
        except Exception as e:
            print(f"  ❌ 验证失败: {model} - {e}")
            invalid_models.append(model)
    
    print(f"\n📊 验证结果:")
    print(f"  ✅ 有效: {valid_count}/{len(models)}")
    print(f"  ❌ 无效: {len(invalid_models)}")
    
    if invalid_models:
        print(f"\n❌ 需要修复的模型:")
        for model in invalid_models:
            print(f"  - {model}")
        
        if input("\n🔧 是否修复无效的模型? (y/N): ").lower() == 'y':
            for model in invalid_models:
                update_model(model)

def clean_cache():
    """清理缓存"""
    print("🧹 清理缓存...")
    
    if input("⚠️  确定要清理所有缓存吗? 这将删除所有下载的模型 (y/N): ").lower() != 'y':
        print("❌ 取消清理")
        return
    
    import shutil
    
    try:
        # 备份配置文件
        config = load_config()
        
        # 清理缓存目录
        for item in os.listdir(CACHE_DIR):
            item_path = os.path.join(CACHE_DIR, item)
            if item != "offline_config.json":
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.remove(item_path)
        
        # 重置配置
        config["downloaded_models"] = []
        save_config(config)
        
        print("✅ 缓存清理完成")
        
    except Exception as e:
        print(f"❌ 清理失败: {e}")

def main():
    parser = argparse.ArgumentParser(description="分词器管理工具")
    parser.add_argument("command", choices=["list", "update", "update-all", "verify", "clean"],
                       help="执行的命令")
    parser.add_argument("--model", help="指定模型名称 (用于 update 命令)")
    
    args = parser.parse_args()
    
    # 确保缓存目录存在
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    if args.command == "list":
        list_models()
    elif args.command == "update":
        if not args.model:
            print("❌ 请指定模型名称: --model MODEL_NAME")
            sys.exit(1)
        update_model(args.model)
    elif args.command == "update-all":
        update_all()
    elif args.command == "verify":
        verify_cache()
    elif args.command == "clean":
        clean_cache()

if __name__ == "__main__":
    main()
