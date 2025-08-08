#!/bin/sh

# 创建日志目录
mkdir -p /data

# 创建日志清理脚本
cat > /usr/local/bin/cleanup-logs.sh << 'EOF'
#!/bin/sh
# 日志清理脚本 - 确保总大小不超过15GB

LOG_DIR="/data"
MAX_SIZE_GB=15
MAX_SIZE_BYTES=$((MAX_SIZE_GB * 1024 * 1024 * 1024))

# 计算当前日志目录总大小
current_size=$(du -sb "$LOG_DIR" 2>/dev/null | cut -f1)

if [ -n "$current_size" ] && [ "$current_size" -gt "$MAX_SIZE_BYTES" ]; then
    echo "$(date): Log directory size ($current_size bytes) exceeds limit ($MAX_SIZE_BYTES bytes). Starting cleanup..." >> "$LOG_DIR/cleanup.log"
    
    # 按修改时间排序，删除最旧的文件直到大小符合要求
    find "$LOG_DIR" -name "*.log.*" -type f -printf '%T@ %p\n' | sort -n | while read timestamp file; do
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
EOF

chmod +x /usr/local/bin/cleanup-logs.sh

# 启动logrotate cron任务（每天执行一次）
echo "0 0 * * * /usr/sbin/logrotate /etc/logrotate.d/one-api" | crontab -

# 添加日志清理任务（每小时检查一次）
echo "0 * * * * /usr/local/bin/cleanup-logs.sh" | crontab -

# 启动crond
crond

# 执行logrotate配置测试
logrotate -d /etc/logrotate.d/one-api

# 启动应用
exec /one-api 