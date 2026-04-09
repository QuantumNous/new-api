local key = KEYS[1]
local reservation_id = ARGV[1]

redis.call("ZREM", key, reservation_id)
if redis.call("ZCARD", key) == 0 then
  redis.call("DEL", key)
end
return 1
