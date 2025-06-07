#!/bin/bash

# Hugging Face TEI Docker构建脚本
# 该脚本会构建包含预下载模型和分词器的TEI镜像

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker服务未运行，请启动Docker服务"
        exit 1
    fi
    
    log_success "Docker检查通过"
}

# 检查NVIDIA Docker支持
check_nvidia_docker() {
    if command -v nvidia-docker &> /dev/null || docker info | grep -q nvidia; then
        log_success "检测到NVIDIA Docker支持"
        return 0
    else
        log_warning "未检测到NVIDIA Docker支持，将使用CPU模式"
        return 1
    fi
}

# 构建Docker镜像
build_image() {
    local image_name="huggingface-tei:latest"

    log_info "开始构建Docker镜像: $image_name"
    log_warning "注意: 首次构建可能需要较长时间，因为需要下载所有分词器"
    log_info "预计下载时间: 30-60分钟（取决于网络速度）"

    # 设置构建参数
    local build_args=""
    if [ ! -z "${HF_ENDPOINT:-}" ]; then
        build_args="--build-arg HF_ENDPOINT=$HF_ENDPOINT"
        log_info "使用HuggingFace镜像: $HF_ENDPOINT"
    fi

    # 构建镜像
    log_info "开始构建，这将强制下载所有支持的分词器..."
    if docker build $build_args -t "$image_name" .; then
        log_success "Docker镜像构建成功: $image_name"

        # 验证分词器下载
        log_info "验证分词器下载情况..."
        docker run --rm "$image_name" python3 -c "
import os
cache_dir = '/data/cache'
if os.path.exists(cache_dir):
    total_files = sum([len(files) for r, d, files in os.walk(cache_dir)])
    print(f'缓存文件总数: {total_files}')
    if total_files > 100:
        print('✅ 分词器下载验证通过')
    else:
        print('⚠️ 分词器文件较少，可能下载不完整')
else:
    print('❌ 缓存目录不存在')
"
    else
        log_error "Docker镜像构建失败"
        exit 1
    fi

    # 显示镜像信息
    log_info "镜像信息:"
    docker images "$image_name"
}

# 显示使用说明
show_usage() {
    cat << EOF

${GREEN}构建完成！${NC}

${BLUE}使用方法:${NC}

1. 启动单个服务:
   docker run --gpus all -p 8080:80 -v \$(pwd)/data:/data \\
     huggingface-tei:latest --model-id BAAI/bge-reranker-v2-m3

2. 使用Docker Compose启动多个服务:
   docker-compose up -d

${BLUE}测试API:${NC}
curl -X POST http://localhost:8080/rerank \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "What is the capital of France?",
    "texts": ["Paris is the capital of France.", "London is the capital of England."]
  }'

EOF
}

# 主函数
main() {
    log_info "开始构建Hugging Face TEI Docker镜像..."
    
    # 检查环境
    check_docker
    check_nvidia_docker
    
    # 构建镜像
    build_image
    
    # 显示使用说明
    show_usage
    
    log_success "构建流程完成！"
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
