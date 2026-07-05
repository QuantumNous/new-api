-- 返回不稳定诊断 SQL(近 7 天)— MySQL 版(>= 5.7,依赖 JSON_EXTRACT)
-- 用法:
--   mysql -h <host> -u <user> -p <dbname> --table < docs/diagnostics/instability.mysql.sql
-- 若日志表在独立库(LOG_SQL_DSN),对日志库执行。
-- 说明:type=2 消费日志,type=5 错误日志;other 字段键名见 service/log_info_generate.go。
-- JSON_VALID 守卫:other 为空串/非 JSON 时 JSON_EXTRACT 会直接报错,必须先过滤。

SELECT '===== [1] 渠道失败率(错误数 vs 消费数)——验证「便宜渠道质量差」=====' AS section;
SELECT
  channel_id,
  SUM(type = 2)                                  AS consume_cnt,
  SUM(type = 5)                                  AS error_cnt,
  ROUND(100.0 * SUM(type = 5) / COUNT(*), 2)     AS error_pct
FROM logs
WHERE type IN (2, 5)
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
GROUP BY channel_id
HAVING COUNT(*) >= 20            -- 样本太少的渠道不看
ORDER BY error_pct DESC;

SELECT '===== [2] 错误日志按 渠道 × 状态码 × 错误码 聚合——看失败集中在哪 =====' AS section;
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(other, '$.channel_id'))   AS channel_id,
  JSON_UNQUOTE(JSON_EXTRACT(other, '$.channel_name')) AS channel_name,
  JSON_UNQUOTE(JSON_EXTRACT(other, '$.status_code'))  AS status_code,
  JSON_UNQUOTE(JSON_EXTRACT(other, '$.error_code'))   AS error_code,
  model_name,
  COUNT(*)                                            AS n
FROM logs
WHERE type = 5
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
  AND JSON_VALID(other)
GROUP BY 1, 3, 4, 5
ORDER BY n DESC
LIMIT 40;

SELECT '===== [3] 流式中断分布(end_reason)——验证「流中途断掉无法 fallback」=====' AS section;
-- end_reason 含义:done/eof/handler_stop=正常;timeout=上游流卡顿超时;
-- scanner_error=读上游流出错;client_gone=客户端断开;panic=处理协程崩溃
SELECT
  channel_id,
  model_name,
  JSON_UNQUOTE(JSON_EXTRACT(other, '$.stream_status.end_reason')) AS end_reason,
  COUNT(*)                                                        AS n
FROM logs
WHERE type = 2
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
  AND JSON_VALID(other)
  AND JSON_EXTRACT(other, '$.stream_status') IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY n DESC
LIMIT 40;

SELECT '===== [3b] 各渠道流式异常率(status=error 占比)=====' AS section;
SELECT
  channel_id,
  COUNT(*)                                            AS stream_cnt,
  SUM(JSON_UNQUOTE(JSON_EXTRACT(other, '$.stream_status.status')) = 'error') AS bad_cnt,
  ROUND(100.0 * SUM(JSON_UNQUOTE(JSON_EXTRACT(other, '$.stream_status.status')) = 'error')
        / COUNT(*), 2)                                AS bad_pct
FROM logs
WHERE type = 2
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
  AND JSON_VALID(other)
  AND JSON_EXTRACT(other, '$.stream_status') IS NOT NULL
GROUP BY channel_id
HAVING COUNT(*) >= 20
ORDER BY bad_pct DESC;

SELECT '===== [4] fallback 触发率(按天)——衡量重试放大的延迟代价 =====' AS section;
SELECT
  DATE(FROM_UNIXTIME(created_at))                     AS day,
  COUNT(*)                                            AS total,
  SUM(JSON_UNQUOTE(JSON_EXTRACT(other, '$.fallback_triggered')) = 'true') AS fallbacks,
  ROUND(100.0 * SUM(JSON_UNQUOTE(JSON_EXTRACT(other, '$.fallback_triggered')) = 'true')
        / COUNT(*), 2)                                AS fallback_pct
FROM logs
WHERE type = 2
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
  AND JSON_VALID(other)
GROUP BY 1
ORDER BY 1;

SELECT '===== [4b] fallback 最终赢家分布——谁在给失败渠道兜底 =====' AS section;
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(other, '$.fallback_winner_channel_id'))   AS winner_id,
  JSON_UNQUOTE(JSON_EXTRACT(other, '$.fallback_winner_channel_name')) AS winner_name,
  COUNT(*)                                                            AS n
FROM logs
WHERE type = 2
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
  AND JSON_VALID(other)
  AND JSON_UNQUOTE(JSON_EXTRACT(other, '$.fallback_triggered')) = 'true'
GROUP BY 1, 2
ORDER BY n DESC;

SELECT '===== [5] 各渠道延迟分布(use_time 秒)——长尾即用户感知的「忽快忽慢」=====' AS section;
SELECT
  channel_id,
  COUNT(*)                        AS n,
  ROUND(AVG(use_time), 1)         AS avg_s,
  MAX(use_time)                   AS max_s,
  SUM(use_time >= 30)             AS over_30s,
  SUM(use_time >= 60)             AS over_60s
FROM logs
WHERE type = 2
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
GROUP BY channel_id
HAVING COUNT(*) >= 20
ORDER BY over_30s DESC;

SELECT '===== [6] 错误按小时聚簇——尖峰簇 = 疑似进程崩溃/发版/渠道整体故障 =====' AS section;
SELECT
  DATE_FORMAT(FROM_UNIXTIME(created_at), '%m-%d %H:00') AS hr,
  COUNT(*)                                              AS errors,
  COUNT(DISTINCT channel_id)                            AS channels_hit
FROM logs
WHERE type = 5
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
GROUP BY 1
HAVING COUNT(*) >= 5
ORDER BY 1;

SELECT '===== [7] 按模型 × 渠道的消费/错误交叉——某模型是否只在特定渠道上坏 =====' AS section;
SELECT
  model_name,
  channel_id,
  SUM(type = 2) AS ok_cnt,
  SUM(type = 5) AS err_cnt
FROM logs
WHERE type IN (2, 5)
  AND created_at >= UNIX_TIMESTAMP() - 7*86400
GROUP BY 1, 2
HAVING SUM(type = 5) > 0
ORDER BY err_cnt DESC
LIMIT 40;
