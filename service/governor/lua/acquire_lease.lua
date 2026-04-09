local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local lease_until_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local reservation_id = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, "-inf", now_ms)
local active = redis.call("ZCARD", key)
if active >= limit then
  return 0
end

redis.call("ZADD", key, lease_until_ms, reservation_id)
redis.call("PEXPIRE", key, math.max(lease_until_ms - now_ms, 1000))
return 1
