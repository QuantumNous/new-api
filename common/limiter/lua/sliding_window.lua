-- 滑动窗口限流器 (sliding window log)
-- 用 sorted set 记录窗口内每次放行的时间戳，保证「任意滚动窗口内放行数 <= limit」，
-- 不存在固定窗口在边界处累计 2x 的突发问题，语义与内存路径 InMemoryRateLimiter 一致。
--
-- KEYS[1]: 限流 key
-- ARGV[1]: 窗口长度(秒)
-- ARGV[2]: 窗口内允许的最大请求数 limit
-- 返回数组: {allowed(1/0), retry_after(秒)}
--   allowed=1 时 retry_after=0；allowed=0 时 retry_after 为最老记录滑出窗口的剩余秒数(>=1)。

local key = KEYS[1]
local windowSeconds = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])

-- 用 Redis 服务器时间，避免多实例客户端时钟漂移
local t = redis.call('TIME')
local nowMs = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local windowMs = windowSeconds * 1000

-- 移除窗口外的旧记录
redis.call('ZREMRANGEBYSCORE', key, 0, nowMs - windowMs)

local count = redis.call('ZCARD', key)
if count < limit then
    -- 用单调自增序列保证成员唯一(同一毫秒并发不会互相覆盖)，仅在放行时自增，故有界。
    -- member 必须用 string.format('%d', ...) 强制整数格式：Redis 的 Lua 5.1 在用 '..' 拼接
    -- 数字时按 %.14g 格式化，超大整数会退化成科学计数法导致成员名不稳定，%d 可彻底规避。
    local seqKey = key .. ':seq'
    local seq = redis.call('INCR', seqKey)
    redis.call('PEXPIRE', seqKey, windowMs + 1000)
    redis.call('ZADD', key, nowMs, string.format('%d-%d', nowMs, seq))
    redis.call('PEXPIRE', key, windowMs + 1000)
    return {1, 0}
end

-- 已达上限：算出最老记录何时滑出窗口
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local retryAfter = windowSeconds
if oldest[2] then
    local resetMs = tonumber(oldest[2]) + windowMs - nowMs
    retryAfter = math.ceil(resetMs / 1000)
end
if retryAfter < 1 then
    retryAfter = 1
end
return {0, retryAfter}
