-- 并发数限制器 (acquire / release)
-- KEYS[1]: 计数器唯一标识
-- ARGV[1]: 操作类型 ("acquire" | "release")
-- ARGV[2]: 最大并发数 (acquire 时使用)
-- ARGV[3]: lease TTL 秒数 (acquire 时使用，防进程崩溃导致计数泄漏)

local key = KEYS[1]
local op = ARGV[1]

if op == "acquire" then
    local max = tonumber(ARGV[2])
    local ttl = tonumber(ARGV[3])
    local current = tonumber(redis.call('GET', key) or '0')
    if current >= max then
        return 0
    end
    local next = redis.call('INCR', key)
    if next == 1 then
        redis.call('EXPIRE', key, ttl)
    end
    return 1
end

if op == "release" then
    local current = tonumber(redis.call('GET', key) or '0')
    if current <= 0 then
        return 0
    end
    redis.call('DECR', key)
    return 1
end

return -1
