#!/bin/bash

# 日志大小监控脚本
LOG_DIR="/data/logs/"
MAX_SIZE_GB=15
MAX_SIZE_BYTES=$((MAX_SIZE_GB * 1024 * 1024 * 1024))

echo "=== 日志大小监控报告 ==="
echo "监控目录: $LOG_DIR"
echo "最大限制: ${MAX_SIZE_GB}GB"
echo "时间: $(date)"
echo ""

# 检查目录是否存在
if [ ! -d "$LOG_DIR" ]; then
    echo "错误: 日志目录不存在: $LOG_DIR"
    exit 1
fi

# 计算当前大小
current_size=$(du -sb "$LOG_DIR" 2>/dev/null | cut -f1)
current_size_gb=$(echo "scale=2; $current_size / 1024 / 1024 / 1024" | bc -l 2>/dev/null || echo "0")

echo "当前总大小: ${current_size} bytes (${current_size_gb} GB)"
echo ""

# 检查是否超过限制
if [ -n "$current_size" ] && [ "$current_size" -gt "$MAX_SIZE_BYTES" ]; then
    echo "⚠️  警告: 日志大小超过限制!"
    echo "当前大小: ${current_size} bytes"
    echo "限制大小: ${MAX_SIZE_BYTES} bytes"
    echo "超出: $((current_size - MAX_SIZE_BYTES)) bytes"
    echo ""
    
    # 显示最大的几个文件
    echo "最大的日志文件:"
    find "$LOG_DIR" -name "*.log*" -type f -exec ls -lh {} \; | sort -k5 -hr | head -10
    echo ""
    
    # 建议清理
    echo "建议执行清理:"
    echo "docker exec -it <container_name> /usr/local/bin/cleanup-logs.sh"
else
    echo "✅ 日志大小在限制范围内"
    echo "剩余空间: $((MAX_SIZE_BYTES - current_size)) bytes"
    echo ""
fi

# 显示文件统计
echo "文件统计:"
echo "总文件数: $(find "$LOG_DIR" -type f | wc -l)"
echo "日志文件数: $(find "$LOG_DIR" -name "*.log" | wc -l)"
echo "压缩文件数: $(find "$LOG_DIR" -name "*.gz" | wc -l)"
echo ""

# 显示最近的文件
echo "最近的日志文件:"
find "$LOG_DIR" -name "*.log*" -type f -exec ls -lh {} \; | sort -k6,7 | tail -5
echo ""

# 显示磁盘使用情况
echo "磁盘使用情况:"
df -h "$LOG_DIR" 