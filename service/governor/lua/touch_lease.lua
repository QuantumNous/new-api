local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local lease_until_ms = tonumber(ARGV[2])
local reservation_id = ARGV[3]

redis.call("ZREMRANGEBYSCORE", key, "-inf", now_ms)
if redis.call("ZSCORE", key, reservation_id) == false then
  return 0
end

redis.call("ZADD", key, lease_until_ms, reservation_id)
redis.call("PEXPIRE", key, math.max(lease_until_ms - now_ms, 1000))
return 1
