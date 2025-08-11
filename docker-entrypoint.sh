#!/bin/sh

# 创建日志目录
mkdir -p /data/logs



# 启动logrotate cron任务（每天执行一次）
(crontab -l 2>/dev/null; echo "0 0 * * * /usr/sbin/logrotate /etc/logrotate.d/one-api") | crontab -

# 添加日志清理任务（每小时检查一次）
(crontab -l 2>/dev/null; echo "0 * * * * /usr/local/bin/cleanup-logs.sh") | crontab -

# 启动crond
crond

# 执行logrotate配置测试
logrotate -d /etc/logrotate.d/one-api

# 启动应用
exec /one-api 