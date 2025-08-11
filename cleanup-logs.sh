#!/bin/bash

# 日志清理脚本 - 确保总大小不超过15GB
LOG_DIR="/data/logs"
MAX_SIZE_GB=15
MAX_SIZE_BYTES=$((MAX_SIZE_GB * 1024 * 1024 * 1024))

# 检查目录是否存在
if [ ! -d "$LOG_DIR" ]; then
    echo "$(date): Error: Log directory does not exist: $LOG_DIR" >> "$LOG_DIR/cleanup.log" 2>/dev/null
    exit 1
fi

# 计算当前大小
current_size=$(du -sb "$LOG_DIR" 2>/dev/null | cut -f1)

# 检查是否超过限制
if [ -n "$current_size" ] && [ "$current_size" -gt "$MAX_SIZE_BYTES" ]; then
    echo "$(date): Log directory size ($current_size bytes) exceeds limit ($MAX_SIZE_BYTES bytes). Starting cleanup..." >> "$LOG_DIR/cleanup.log"
    
    # 按修改时间排序，删除最旧的文件直到大小符合要求
    find "$LOG_DIR" \( -name "*.log" -o -name "*.log.*" \) -type f -printf '%T@ %p\n' | sort -n | while read timestamp file; do
        if [ "$current_size" -le "$MAX_SIZE_BYTES" ]; then
            break
        fi
        
        file_size=$(stat -c%s "$file" 2>/dev/null || echo 0)
        if [ "$file_size" -gt 0 ]; then
            echo "$(date): Removing old log file: $file (size: $file_size bytes)" >> "$LOG_DIR/cleanup.log"
            rm -f "$file"
            current_size=$((current_size - file_size))
        fi
    done
    
    echo "$(date): Cleanup completed. New size: $current_size bytes" >> "$LOG_DIR/cleanup.log"
fi 