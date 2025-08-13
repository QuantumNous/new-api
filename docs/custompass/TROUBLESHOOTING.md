# CustomPass 故障排除指南

本文档提供CustomPass渠道常见问题的诊断方法和解决方案，帮助用户快速定位和解决问题。

## 快速诊断

### 系统状态检查

```bash
# 检查服务状态
systemctl status newapi

# 检查端口监听
netstat -tlnp | grep :3000

# 检查进程
ps aux | grep newapi

# 检查资源使用
top -p $(pgrep newapi)
```

### 健康检查脚本

```bash
#!/bin/bash
# quick_health_check.sh

echo "=== CustomPass 健康检查 ==="

# 1. 检查API服务
echo "1. 检查API服务..."
if curl -s -f http://localhost:3000/api/status > /dev/null; then
    echo "✓ API服务正常"
else
    echo "✗ API服务异常"
fi

# 2. 检查数据库连接
echo "2. 检查数据库连接..."
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✓ 数据库连接正常"
else
    echo "✗ 数据库连接异常"
fi

# 3. 检查CustomPass渠道
echo "3. 检查CustomPass渠道..."
CUSTOMPASS_COUNT=$(curl -s http://localhost:3000/api/channel | jq '[.data[] | select(.type == 52)] | length' 2>/dev/null || echo "0")
echo "  CustomPass渠道数量: $CUSTOMPASS_COUNT"

# 4. 检查活跃任务
echo "4. 检查活跃任务..."
if command -v psql > /dev/null; then
    ACTIVE_TASKS=$(psql -h localhost -U newapi -d newapi -t -c "SELECT count(*) FROM tasks WHERE platform='custompass' AND status IN ('submitted', 'processing');" 2>/dev/null | xargs || echo "N/A")
    echo "  活跃CustomPass任务: $ACTIVE_TASKS"
fi

# 5. 检查日志错误
echo "5. 检查最近错误..."
if [ -f "/var/log/newapi.log" ]; then
    ERROR_COUNT=$(tail -1000 /var/log/newapi.log | grep -i "error\|fail" | wc -l)
    echo "  最近1000行日志中的错误: $ERROR_COUNT"
fi

echo "=== 检查完成 ==="
```

## 常见问题和解决方案

### 1. 渠道配置问题

#### 问题：CustomPass渠道创建失败

**症状**：
- 创建渠道时提示"配置错误"
- 渠道保存后无法正常工作

**诊断步骤**：
```bash
# 检查渠道配置
curl -s http://localhost:3000/api/channel | jq '.data[] | select(.type == 52)'

# 检查日志
tail -f /var/log/newapi.log | grep -i custompass
```

**常见原因和解决方案**：

1. **Base URL格式错误**
   ```bash
   # 错误格式
   "base_url": "api.example.com"
   "base_url": "https://api.example.com/v1/"
   
   # 正确格式
   "base_url": "https://api.example.com"
   ```

2. **模型名称配置错误**
   ```bash
   # 异步模型必须以/submit结尾
   # 错误
   "models": ["custom-image-gen"]
   
   # 正确
   "models": ["custom-image-gen/submit"]
   ```

3. **API密钥格式错误**
   ```bash
   # 检查API密钥格式
   echo "API密钥长度: $(echo 'your-api-key' | wc -c)"
   # 确保没有多余的空格或换行符
   ```

#### 问题：渠道测试失败

**症状**：
- 渠道测试返回连接错误
- 上游API认证失败

**诊断步骤**：
```bash
# 手动测试上游API连接
curl -v -X POST "https://upstream-api.com/test" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"test": "connection"}'

# 检查DNS解析
nslookup upstream-api.com

# 检查网络连通性
telnet upstream-api.com 443
```

**解决方案**：
1. 验证上游API地址和端口
2. 检查API密钥有效性
3. 确认网络防火墙设置
4. 检查SSL证书问题

### 2. 同步API问题

#### 问题：同步请求超时

**症状**：
- 请求长时间无响应
- 返回504 Gateway Timeout错误

**诊断步骤**：
```bash
# 检查请求处理时间
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/v1/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "test"}]}'

# curl-format.txt内容：
#      time_namelookup:  %{time_namelookup}\n
#         time_connect:  %{time_connect}\n
#      time_appconnect:  %{time_appconnect}\n
#     time_pretransfer:  %{time_pretransfer}\n
#        time_redirect:  %{time_redirect}\n
#   time_starttransfer:  %{time_starttransfer}\n
#                      ----------\n
#           time_total:  %{time_total}\n
```

**解决方案**：
1. **增加超时时间**
   ```bash
   # 环境变量配置
   export CUSTOM_PASS_HTTP_TIMEOUT=120s
   ```

2. **检查上游API性能**
   ```bash
   # 直接测试上游API响应时间
   time curl -X POST "https://upstream-api.com/endpoint" \
     -H "Authorization: Bearer api-key" \
     -d '{"test": "performance"}'
   ```

3. **优化数据库连接**
   ```sql
   -- 检查数据库连接数
   SELECT count(*) FROM pg_stat_activity WHERE datname='newapi';
   
   -- 检查长时间运行的查询
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
   ```

#### 问题：预扣费失败

**症状**：
- 返回"余额不足"错误
- 用户有足够余额但仍然失败

**诊断步骤**：
```sql
-- 检查用户余额
SELECT id, quota, used_quota, quota - used_quota as available 
FROM users 
WHERE id = USER_ID;

-- 检查预扣费记录
SELECT * FROM logs 
WHERE user_id = USER_ID 
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 检查数据库锁
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**解决方案**：
1. **检查并发控制**
   ```go
   // 增加重试机制
   for i := 0; i < 3; i++ {
       err := executePrecharge(userID, amount)
       if err == nil {
           break
       }
       if strings.Contains(err.Error(), "could not obtain lock") {
           time.Sleep(time.Duration(i+1) * time.Second)
           continue
       }
       return err
   }
   ```

2. **优化数据库事务**
   ```sql
   -- 使用NOWAIT避免长时间等待
   SELECT * FROM users WHERE id = $1 FOR UPDATE NOWAIT;
   ```

### 3. 异步任务问题

#### 问题：任务提交成功但状态不更新

**症状**：
- 任务一直显示"submitted"状态
- 轮询服务没有更新任务状态

**诊断步骤**：
```sql
-- 检查任务状态分布
SELECT status, count(*) 
FROM tasks 
WHERE platform = 'custompass' 
GROUP BY status;

-- 检查长时间未更新的任务
SELECT task_id, status, created_at, updated_at,
       NOW() - updated_at as stale_duration
FROM tasks 
WHERE platform = 'custompass' 
AND status IN ('submitted', 'processing')
AND updated_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at;

-- 检查轮询服务日志
grep -i "polling\|custompass" /var/log/newapi.log | tail -20
```

**解决方案**：
1. **检查轮询服务配置**
   ```bash
   # 检查环境变量
   echo "轮询间隔: $CUSTOM_PASS_POLL_INTERVAL"
   echo "批量大小: $CUSTOM_PASS_BATCH_SIZE"
   echo "最大并发: $CUSTOM_PASS_MAX_CONCURRENT"
   ```

2. **手动触发轮询**
   ```bash
   # 重启服务触发轮询
   systemctl restart newapi
   
   # 或者发送信号
   kill -USR1 $(pgrep newapi)
   ```

3. **检查上游API响应**
   ```bash
   # 手动查询任务状态
   curl -X POST "https://upstream-api.com/task/list-by-condition" \
     -H "Authorization: Bearer api-key" \
     -H "Content-Type: application/json" \
     -d '{"task_ids": ["task-id-here"]}'
   ```

#### 问题：任务状态映射错误

**症状**：
- 上游返回"completed"但系统显示"unknown"
- 状态映射不生效

**诊断步骤**：
```bash
# 检查状态映射配置
echo "成功状态: $CUSTOM_PASS_STATUS_SUCCESS"
echo "失败状态: $CUSTOM_PASS_STATUS_FAILED"
echo "处理中状态: $CUSTOM_PASS_STATUS_PROCESSING"

# 检查渠道配置中的状态映射
curl -s http://localhost:3000/api/channel/CHANNEL_ID | jq '.data.custompass_status_mapping'
```

**解决方案**：
1. **更新状态映射配置**
   ```bash
   # 环境变量方式
   export CUSTOM_PASS_STATUS_SUCCESS="completed,success,finished,done"
   export CUSTOM_PASS_STATUS_FAILED="failed,error,cancelled,timeout"
   export CUSTOM_PASS_STATUS_PROCESSING="processing,pending,running,in_progress"
   ```

2. **渠道配置方式**
   ```json
   {
     "custompass_status_mapping": {
       "success": ["completed", "success", "finished", "done"],
       "failed": ["failed", "error", "cancelled", "timeout"],
       "processing": ["processing", "pending", "running", "in_progress"]
     }
   }
   ```

### 4. 计费问题

#### 问题：计费金额不正确

**症状**：
- 扣费金额与预期不符
- 没有退还多扣的费用

**诊断步骤**：
```sql
-- 检查用户计费记录
SELECT id, user_id, quota, created_at, type, model_name, prompt_tokens, completion_tokens
FROM logs 
WHERE user_id = USER_ID 
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 检查模型计费配置
SELECT model_name, channel_type, ratio, fixed_quota
FROM abilities 
WHERE channel_type = 52;

-- 检查用户分组倍率
SELECT * FROM group_ratio WHERE group_name = 'USER_GROUP';
```

**解决方案**：
1. **验证计费配置**
   ```sql
   -- 更新模型计费配置
   INSERT INTO abilities (model_name, channel_type, ratio) 
   VALUES ('gpt-4', 52, 1.5) 
   ON CONFLICT (model_name, channel_type) 
   DO UPDATE SET ratio = 1.5;
   ```

2. **手动调整用户余额**
   ```sql
   -- 退还错误扣费
   UPDATE users 
   SET quota = quota + REFUND_AMOUNT, 
       used_quota = used_quota - REFUND_AMOUNT 
   WHERE id = USER_ID;
   ```

#### 问题：预扣费没有退还

**症状**：
- 任务完成后没有退还多扣的quota
- 预扣费金额大于实际消费

**诊断步骤**：
```sql
-- 检查任务的预扣费和实际消费
SELECT task_id, quota as precharge_quota, used_quota as actual_quota,
       quota - used_quota as should_refund
FROM tasks 
WHERE platform = 'custompass' 
AND status = 'completed'
AND quota > used_quota;

-- 检查退款记录
SELECT * FROM logs 
WHERE type = 'refund' 
AND created_at > NOW() - INTERVAL '1 hour';
```

**解决方案**：
1. **手动处理退款**
   ```sql
   -- 批量处理未退款的任务
   WITH refund_tasks AS (
     SELECT task_id, user_id, quota - used_quota as refund_amount
     FROM tasks 
     WHERE platform = 'custompass' 
     AND status = 'completed'
     AND quota > used_quota
   )
   UPDATE users 
   SET quota = quota + rt.refund_amount
   FROM refund_tasks rt
   WHERE users.id = rt.user_id;
   ```

### 5. 性能问题

#### 问题：响应时间过长

**症状**：
- API响应时间超过5秒
- 系统负载过高

**诊断步骤**：
```bash
# 检查系统资源
top -p $(pgrep newapi)
iostat -x 1 5
free -h

# 检查数据库性能
psql -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 检查网络延迟
ping -c 5 upstream-api.com
traceroute upstream-api.com
```

**解决方案**：
1. **数据库优化**
   ```sql
   -- 添加索引
   CREATE INDEX CONCURRENTLY idx_tasks_custompass_performance 
   ON tasks (platform, status, updated_at) 
   WHERE platform = 'custompass';
   
   -- 更新统计信息
   ANALYZE tasks;
   ```

2. **连接池优化**
   ```bash
   # 增加数据库连接池大小
   export CUSTOM_PASS_DB_MAX_OPEN_CONNS=100
   export CUSTOM_PASS_DB_MAX_IDLE_CONNS=25
   ```

3. **缓存优化**
   ```bash
   # 启用Redis缓存
   export REDIS_CONN_STRING=redis://localhost:6379
   export ENABLE_CACHE=true
   ```

#### 问题：内存使用过高

**症状**：
- 内存使用超过2GB
- 出现OOM错误

**诊断步骤**：
```bash
# 检查内存使用详情
pmap -x $(pgrep newapi)

# 检查Go内存分析
curl http://localhost:6060/debug/pprof/heap > heap.prof
go tool pprof heap.prof

# 检查goroutine数量
curl http://localhost:6060/debug/pprof/goroutine?debug=1
```

**解决方案**：
1. **调整GC参数**
   ```bash
   export GOGC=100
   export GOMEMLIMIT=2GiB
   ```

2. **优化批量处理**
   ```bash
   # 减少批量大小
   export CUSTOM_PASS_BATCH_SIZE=25
   ```

### 6. 网络问题

#### 问题：上游API连接失败

**症状**：
- 连接超时错误
- DNS解析失败

**诊断步骤**：
```bash
# 检查DNS解析
nslookup upstream-api.com
dig upstream-api.com

# 检查网络连通性
telnet upstream-api.com 443
curl -v https://upstream-api.com

# 检查防火墙规则
iptables -L -n
ufw status
```

**解决方案**：
1. **配置DNS**
   ```bash
   # 添加DNS服务器
   echo "nameserver 8.8.8.8" >> /etc/resolv.conf
   echo "nameserver 8.8.4.4" >> /etc/resolv.conf
   ```

2. **配置代理**
   ```bash
   # 如果需要代理
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   ```

3. **调整超时设置**
   ```bash
   export CUSTOM_PASS_HTTP_TIMEOUT=120s
   export CUSTOM_PASS_TASK_TIMEOUT=30s
   ```

## 日志分析

### 日志级别和格式

```bash
# 设置详细日志
export LOG_LEVEL=debug
export CUSTOM_PASS_LOG_LEVEL=debug

# 日志格式示例
# 2024-01-01T12:00:00Z [INFO] custompass: sync_request user_id=123 channel_id=1 model=gpt-4 duration=1.5s status=success
# 2024-01-01T12:00:01Z [ERROR] custompass: precharge_failed user_id=123 error="insufficient quota"
# 2024-01-01T12:00:02Z [DEBUG] custompass: polling_tasks channel_id=1 task_count=5 duration=0.5s
```

### 常用日志查询

```bash
# 查看CustomPass相关日志
grep -i custompass /var/log/newapi.log | tail -50

# 查看错误日志
grep -i "error\|fail" /var/log/newapi.log | grep -i custompass | tail -20

# 查看特定用户的日志
grep "user_id=123" /var/log/newapi.log | grep custompass

# 查看性能相关日志
grep -E "duration=[0-9]+\.[0-9]+s" /var/log/newapi.log | grep custompass

# 实时监控日志
tail -f /var/log/newapi.log | grep --line-buffered custompass
```

### 日志分析脚本

```bash
#!/bin/bash
# analyze_custompass_logs.sh

LOG_FILE="/var/log/newapi.log"
HOURS=${1:-1}  # 默认分析最近1小时

echo "=== CustomPass 日志分析 (最近 ${HOURS} 小时) ==="

# 获取时间范围
START_TIME=$(date -d "${HOURS} hours ago" '+%Y-%m-%dT%H:%M:%S')

# 统计请求数量
echo "1. 请求统计:"
grep -E "${START_TIME}" "$LOG_FILE" | grep custompass | \
  grep -E "sync_request|async_request" | \
  awk '{print $4}' | sort | uniq -c | sort -nr

# 统计错误类型
echo -e "\n2. 错误统计:"
grep -E "${START_TIME}" "$LOG_FILE" | grep custompass | \
  grep -i error | \
  awk -F'error=' '{print $2}' | awk '{print $1}' | \
  sort | uniq -c | sort -nr

# 统计响应时间
echo -e "\n3. 响应时间分析:"
grep -E "${START_TIME}" "$LOG_FILE" | grep custompass | \
  grep -E "duration=[0-9]+\.[0-9]+s" | \
  sed -E 's/.*duration=([0-9]+\.[0-9]+)s.*/\1/' | \
  awk '{
    sum += $1; 
    count++; 
    if($1 > max) max = $1; 
    if(min == 0 || $1 < min) min = $1
  } 
  END {
    if(count > 0) {
      printf "平均: %.2fs, 最小: %.2fs, 最大: %.2fs, 总数: %d\n", sum/count, min, max, count
    }
  }'

# 统计活跃用户
echo -e "\n4. 活跃用户 (Top 10):"
grep -E "${START_TIME}" "$LOG_FILE" | grep custompass | \
  grep -E "user_id=[0-9]+" | \
  sed -E 's/.*user_id=([0-9]+).*/\1/' | \
  sort | uniq -c | sort -nr | head -10

echo -e "\n=== 分析完成 ==="
```

## 监控和告警

### 关键指标监控

```bash
# 创建监控脚本
cat > /opt/newapi/scripts/custompass_monitor.sh << 'EOF'
#!/bin/bash

# CustomPass关键指标监控
METRICS_URL="http://localhost:9090/metrics"

# 获取指标
REQUEST_RATE=$(curl -s $METRICS_URL | grep "custompass_requests_total" | awk '{sum+=$2} END {print sum/60}')
ERROR_RATE=$(curl -s $METRICS_URL | grep "custompass_requests_total.*error" | awk '{sum+=$2} END {print sum}')
ACTIVE_TASKS=$(curl -s $METRICS_URL | grep "custompass_tasks_in_queue.*submitted" | awk '{print $2}')

# 检查阈值
if (( $(echo "$REQUEST_RATE > 100" | bc -l) )); then
    echo "ALERT: High request rate: $REQUEST_RATE req/min"
fi

if (( $(echo "$ERROR_RATE > 10" | bc -l) )); then
    echo "ALERT: High error rate: $ERROR_RATE errors"
fi

if (( $(echo "$ACTIVE_TASKS > 50" | bc -l) )); then
    echo "ALERT: High task queue: $ACTIVE_TASKS tasks"
fi

echo "CustomPass Metrics: RPS=$REQUEST_RATE, Errors=$ERROR_RATE, Tasks=$ACTIVE_TASKS"
EOF

chmod +x /opt/newapi/scripts/custompass_monitor.sh

# 添加到crontab
echo "*/5 * * * * /opt/newapi/scripts/custompass_monitor.sh" | crontab -
```

### 告警配置

```yaml
# prometheus-alerts.yml
groups:
  - name: custompass
    rules:
      - alert: CustomPassHighErrorRate
        expr: rate(custompass_requests_total{status="error"}[5m]) / rate(custompass_requests_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "CustomPass error rate is high"
          description: "Error rate is {{ $value | humanizePercentage }}"
      
      - alert: CustomPassTaskQueueBacklog
        expr: custompass_tasks_in_queue{status="submitted"} > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CustomPass task queue has backlog"
          description: "{{ $value }} tasks are waiting in queue"
```

## 应急处理

### 紧急故障处理流程

1. **立即响应**
   ```bash
   # 检查服务状态
   systemctl status newapi
   
   # 查看最新错误
   tail -50 /var/log/newapi.log | grep -i error
   
   # 检查系统资源
   top -bn1 | head -20
   ```

2. **快速恢复**
   ```bash
   # 重启服务
   systemctl restart newapi
   
   # 如果数据库问题
   systemctl restart postgresql
   
   # 清理临时文件
   rm -rf /tmp/newapi-*
   ```

3. **回滚操作**
   ```bash
   # 如果是升级导致的问题
   systemctl stop newapi
   cp /opt/newapi/new-api.backup /opt/newapi/new-api
   systemctl start newapi
   ```

### 数据恢复

```bash
# 恢复最近的数据库备份
systemctl stop newapi
gunzip -c /opt/newapi/backups/latest.sql.gz | psql -U newapi -d newapi
systemctl start newapi

# 验证数据完整性
psql -U newapi -d newapi -c "SELECT count(*) FROM tasks WHERE platform='custompass';"
```

这个故障排除指南涵盖了CustomPass的常见问题和解决方案，帮助用户快速诊断和解决问题，确保系统稳定运行。