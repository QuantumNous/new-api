-- 并发数限制器 (acquire / renew / release)
-- KEYS[1]: 计数器唯一标识（sorted set：member = lease ID，score = 过期时间戳）
-- ARGV[1]: 操作类型 ("acquire" | "renew" | "release")
-- acquire: ARGV[2] = 最大并发数, ARGV[3] = lease TTL 秒数, ARGV[4] = lease ID
-- renew:   ARGV[2] = lease TTL 秒数, ARGV[3] = lease ID
-- release: ARGV[2] = lease ID
--
-- lease ID 是每次请求唯一的 opaque 标识；lease TTL 仅用于进程崩溃后的
-- 自动回收，存活请求通过 renew 续租，长请求（如 realtime）不会因
-- TTL 到期丢失槽位，release 只移除自己的 lease，不会误减重建后的计数。

redis.replicate_commands()

local key = KEYS[1]
local op = ARGV[1]

if op == "acquire" then
    local max = tonumber(ARGV[2])
    local ttl = tonumber(ARGV[3])
    local leaseId = ARGV[4]
    local now = tonumber(redis.call('TIME')[1])
    -- 惰性清理已过期的 lease（持有方进程崩溃后未 release 的槽位）
    redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
    if redis.call('ZCARD', key) >= max then
        return 0
    end
    redis.call('ZADD', key, now + ttl, leaseId)
    redis.call('EXPIRE', key, ttl)
    return 1
end

if op == "renew" then
    local ttl = tonumber(ARGV[2])
    local leaseId = ARGV[3]
    local now = tonumber(redis.call('TIME')[1])
    if redis.call('ZSCORE', key, leaseId) == false then
        return 0
    end
    redis.call('ZADD', key, now + ttl, leaseId)
    redis.call('EXPIRE', key, ttl)
    return 1
end

if op == "release" then
    redis.call('ZREM', key, ARGV[2])
    return 1
end

return -1
