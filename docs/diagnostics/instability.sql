-- 返回不稳定诊断 SQL(近 7 天)
-- 用法(SQLite,生产库):
--   sqlite3 -header -column /path/to/new-api.db < docs/diagnostics/instability.sql
-- 若日志表在独立库(LOG_SQL_DSN),对日志库执行。
-- MySQL 版差异:strftime('%s','now') 改 UNIX_TIMESTAMP(),
--   date(created_at,'unixepoch','localtime') 改 DATE(FROM_UNIXTIME(created_at)),
--   json_extract 两边同名可直接用。
-- 说明:type=2 消费日志,type=5 错误日志;quota/other 字段含义见 service/log_info_generate.go。

.print '===== [1] 渠道失败率(错误数 vs 消费数)——验证「便宜渠道质量差」====='
SELECT
  channel_id,
  SUM(CASE WHEN type = 2 THEN 1 ELSE 0 END)                        AS consume_cnt,
  SUM(CASE WHEN type = 5 THEN 1 ELSE 0 END)                        AS error_cnt,
  ROUND(100.0 * SUM(CASE WHEN type = 5 THEN 1 ELSE 0 END)
        / COUNT(*), 2)                                             AS error_pct
FROM logs
WHERE type IN (2, 5)
  AND created_at >= strftime('%s','now') - 7*86400
GROUP BY channel_id
HAVING COUNT(*) >= 20            -- 样本太少的渠道不看
ORDER BY error_pct DESC;

.print ''
.print '===== [2] 错误日志按 渠道 × 状态码 × 错误码 聚合——看失败集中在哪 ====='
SELECT
  json_extract(other, '$.channel_id')    AS channel_id,
  json_extract(other, '$.channel_name')  AS channel_name,
  json_extract(other, '$.status_code')   AS status_code,
  json_extract(other, '$.error_code')    AS error_code,
  model_name,
  COUNT(*)                               AS n
FROM logs
WHERE type = 5
  AND created_at >= strftime('%s','now') - 7*86400
GROUP BY 1, 3, 4, 5
ORDER BY n DESC
LIMIT 40;

.print ''
.print '===== [3] 流式中断分布(end_reason)——验证「流中途断掉无法 fallback」====='
-- end_reason 含义:done/eof/handler_stop=正常;timeout=上游流卡顿超时;
-- scanner_error=读上游流出错;client_gone=客户端断开;panic=处理协程崩溃
SELECT
  channel_id,
  model_name,
  json_extract(other, '$.stream_status.end_reason') AS end_reason,
  COUNT(*)                                          AS n
FROM logs
WHERE type = 2
  AND created_at >= strftime('%s','now') - 7*86400
  AND json_extract(other, '$.stream_status') IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY n DESC
LIMIT 40;

.print ''
.print '===== [3b] 各渠道流式异常率(status=error 占比)====='
SELECT
  channel_id,
  COUNT(*)                                                          AS stream_cnt,
  SUM(CASE WHEN json_extract(other,'$.stream_status.status') = 'error'
       THEN 1 ELSE 0 END)                                           AS bad_cnt,
  ROUND(100.0 * SUM(CASE WHEN json_extract(other,'$.stream_status.status') = 'error'
       THEN 1 ELSE 0 END) / COUNT(*), 2)                            AS bad_pct
FROM logs
WHERE type = 2
  AND created_at >= strftime('%s','now') - 7*86400
  AND json_extract(other, '$.stream_status') IS NOT NULL
GROUP BY channel_id
HAVING COUNT(*) >= 20
ORDER BY bad_pct DESC;

.print ''
.print '===== [4] fallback 触发率(按天)——衡量重试放大的延迟代价 ====='
SELECT
  date(created_at, 'unixepoch', 'localtime')            AS day,
  COUNT(*)                                              AS total,
  SUM(json_extract(other, '$.fallback_triggered'))      AS fallbacks,
  ROUND(100.0 * SUM(json_extract(other,'$.fallback_triggered'))
        / COUNT(*), 2)                                  AS fallback_pct
FROM logs
WHERE type = 2
  AND created_at >= strftime('%s','now') - 7*86400
GROUP BY 1
ORDER BY 1;

.print ''
.print '===== [4b] fallback 最终赢家分布——谁在给失败渠道兜底 ====='
SELECT
  json_extract(other, '$.fallback_winner_channel_id')   AS winner_id,
  json_extract(other, '$.fallback_winner_channel_name') AS winner_name,
  COUNT(*)                                              AS n
FROM logs
WHERE type = 2
  AND created_at >= strftime('%s','now') - 7*86400
  AND json_extract(other, '$.fallback_triggered') = 1
GROUP BY 1
ORDER BY n DESC;

.print ''
.print '===== [5] 各渠道延迟分布(use_time 秒)——长尾即用户感知的「忽快忽慢」====='
SELECT
  channel_id,
  COUNT(*)                                              AS n,
  ROUND(AVG(use_time), 1)                               AS avg_s,
  MAX(use_time)                                         AS max_s,
  SUM(CASE WHEN use_time >= 30 THEN 1 ELSE 0 END)       AS over_30s,
  SUM(CASE WHEN use_time >= 60 THEN 1 ELSE 0 END)       AS over_60s
FROM logs
WHERE type = 2
  AND created_at >= strftime('%s','now') - 7*86400
GROUP BY channel_id
HAVING COUNT(*) >= 20
ORDER BY over_30s DESC;

.print ''
.print '===== [6] 错误按小时聚簇——尖峰簇 = 疑似进程崩溃/发版/渠道整体故障 ====='
SELECT
  strftime('%m-%d %H:00', created_at, 'unixepoch', 'localtime') AS hour,
  COUNT(*)                                                      AS errors,
  COUNT(DISTINCT channel_id)                                    AS channels_hit
FROM logs
WHERE type = 5
  AND created_at >= strftime('%s','now') - 7*86400
GROUP BY 1
HAVING COUNT(*) >= 5
ORDER BY 1;

.print ''
.print '===== [7] 按模型 × 渠道的消费/错误交叉——某模型是否只在特定渠道上坏 ====='
SELECT
  model_name,
  channel_id,
  SUM(CASE WHEN type = 2 THEN 1 ELSE 0 END) AS ok_cnt,
  SUM(CASE WHEN type = 5 THEN 1 ELSE 0 END) AS err_cnt
FROM logs
WHERE type IN (2, 5)
  AND created_at >= strftime('%s','now') - 7*86400
GROUP BY 1, 2
HAVING SUM(CASE WHEN type = 5 THEN 1 ELSE 0 END) > 0
ORDER BY err_cnt DESC
LIMIT 40;
