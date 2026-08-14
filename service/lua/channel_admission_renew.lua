local lease_id = ARGV[1]
local lease_ttl_ms = tonumber(ARGV[2])

if not redis.call('ZSCORE', KEYS[1], lease_id) then
  return 0
end

local redis_time = redis.call('TIME')
local now_ms = tonumber(redis_time[1]) * 1000 + math.floor(tonumber(redis_time[2]) / 1000)
redis.call('ZADD', KEYS[1], 'XX', now_ms + lease_ttl_ms, lease_id)
redis.call('PEXPIRE', KEYS[1], lease_ttl_ms * 2)
return 1
