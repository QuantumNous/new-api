-- 滑动窗口限流器
-- KEYS[1]: 限流 key
-- ARGV[1]: 最大请求数
-- ARGV[2]: 时间窗口(秒)
-- ARGV[3]: 当前时间戳(秒)
-- ARGV[4]: key 过期时间(秒)
-- 返回: 1=放行, 0=拒绝

local key = KEYS[1]
local maxReq = tonumber(ARGV[1])
local duration = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local expiration = tonumber(ARGV[4])

local len = redis.call('LLEN', key)

if len < maxReq then
    redis.call('LPUSH', key, now)
    redis.call('EXPIRE', key, expiration)
    return 1
end

local oldest = redis.call('LINDEX', key, -1)
if oldest and (now - tonumber(oldest)) >= duration then
    redis.call('LPUSH', key, now)
    redis.call('LTRIM', key, 0, maxReq - 1)
    redis.call('EXPIRE', key, expiration)
    return 1
end

redis.call('EXPIRE', key, expiration)
return 0
