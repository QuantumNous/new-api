-- One-time, conservative backfill for legacy quota_data.channel_id = 0 rows.
-- Use this only when logs and quota_data are in the same MySQL database.
-- Back up quota_data before running it.
--
-- This script updates only unambiguous rows: a quota_data row is changed only
-- when matching consume logs map to exactly one non-zero channel and the
-- aggregated count/quota/token totals match the quota_data row exactly.
-- Ambiguous rows are left unchanged so total dashboard amounts do not change.

START TRANSACTION;

UPDATE quota_data q
JOIN (
  SELECT
    q.id,
    MIN(l.channel_id) AS channel_id
  FROM quota_data q
  JOIN (
    SELECT
      user_id,
      username,
      model_name,
      created_at - MOD(created_at, 3600) AS created_at,
      `group` AS use_group,
      token_id,
      channel_id,
      COUNT(*) AS `count`,
      COALESCE(SUM(quota), 0) AS quota,
      COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS token_used
    FROM logs
    WHERE type = 2 AND channel_id <> 0
    GROUP BY
      user_id,
      username,
      model_name,
      created_at - MOD(created_at, 3600),
      `group`,
      token_id,
      channel_id
  ) l
    ON q.user_id = l.user_id
   AND q.username = l.username
   AND q.model_name = l.model_name
   AND q.created_at = l.created_at
   AND q.use_group = l.use_group
   AND q.token_id = l.token_id
  WHERE q.channel_id = 0
  GROUP BY q.id, q.`count`, q.quota, q.token_used
  HAVING
    COUNT(*) = 1
    AND COALESCE(SUM(l.`count`), 0) = q.`count`
    AND COALESCE(SUM(l.quota), 0) = q.quota
    AND COALESCE(SUM(l.token_used), 0) = q.token_used
) matches ON q.id = matches.id
SET q.channel_id = matches.channel_id;

COMMIT;

-- Optional verification: rows returned here need manual review because they
-- either have no matching logs or match more than one channel.
SELECT
  q.id,
  q.user_id,
  q.username,
  q.model_name,
  q.created_at,
  q.use_group,
  q.token_id,
  q.`count`,
  q.quota,
  q.token_used,
  COUNT(l.channel_id) AS matching_channels
FROM quota_data q
LEFT JOIN (
  SELECT
    user_id,
    username,
    model_name,
    created_at - MOD(created_at, 3600) AS created_at,
    `group` AS use_group,
    token_id,
    channel_id
  FROM logs
  WHERE type = 2 AND channel_id <> 0
  GROUP BY
    user_id,
    username,
    model_name,
    created_at - MOD(created_at, 3600),
    `group`,
    token_id,
    channel_id
) l
  ON q.user_id = l.user_id
 AND q.username = l.username
 AND q.model_name = l.model_name
 AND q.created_at = l.created_at
 AND q.use_group = l.use_group
 AND q.token_id = l.token_id
WHERE q.channel_id = 0
GROUP BY
  q.id,
  q.user_id,
  q.username,
  q.model_name,
  q.created_at,
  q.use_group,
  q.token_id,
  q.`count`,
  q.quota,
  q.token_used
ORDER BY q.created_at DESC;
