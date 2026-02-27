-- 通知限速原子计数器
-- KEYS[1]: 限速 key（含用户ID、通知类型、时间窗口）
-- ARGV[1]: 最大允许次数
-- ARGV[2]: 过期时间（秒）
-- 返回: 1 = 允许, 0 = 超限

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, ttl)
end

if current <= limit then
    return 1
else
    return 0
end
