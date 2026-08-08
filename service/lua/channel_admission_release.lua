local removed = redis.call('ZREM', KEYS[1], ARGV[1])
if tonumber(ARGV[2]) == 1 then
  removed = removed + redis.call('ZREM', KEYS[2], ARGV[1])
end
return removed
