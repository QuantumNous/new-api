-- 成功请求滑动窗口预留（单次原子操作）
-- KEYS[1]: 窗口 key（有序集合，score 为预留时间戳，单位毫秒）
-- ARGV[1]: 窗口长度（毫秒）
-- ARGV[2]: 窗口内允许的最大预留数
-- ARGV[3]: 本次预留的唯一成员
--
-- 判定与登记在同一个脚本里完成：并发请求不会同时读到"尚未超出上限"的状态，
-- 因此突发并发不会绕过成功请求数限制。

local key = KEYS[1]
local window = tonumber(ARGV[1])
local max_count = tonumber(ARGV[2])
local member = ARGV[3]

if window < 1 then
    window = 1
end

-- 使用 Redis 服务器时间，避免多实例之间的时钟漂移
local now = redis.call('TIME')
local now_ms = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)

-- 先清理滑动窗口之外的预留，再统计窗口内的预留数
redis.call('ZREMRANGEBYSCORE', key, '-inf', now_ms - window)

local count = redis.call('ZCARD', key)
if count >= max_count then
    return 0
end

-- 成员已存在时只更新时间戳，不会重复占用名额
redis.call('ZADD', key, now_ms, member)
-- 最后一次预留之后窗口内不再有有效成员，key 随窗口一起过期即可
redis.call('PEXPIRE', key, window)

return 1
