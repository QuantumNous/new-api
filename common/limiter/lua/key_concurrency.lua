-- 密钥并发控制脚本
-- KEYS[1]: keyRL:concurrency:{channelId}:{keyIndex}
-- ARGV[1]: max_concurrency (0=无限制)
-- ARGV[2]: 操作类型 (acquire=获取, release=释放)
-- ARGV[3]: 过期时间（秒）
-- 返回值:
--   acquire: 1=成功获取, 0=已满, -1=参数错误
--   release: 当前并发数

local key = KEYS[1]
local maxConcurrency = tonumber(ARGV[1])
local operation = ARGV[2]
local expireTime = tonumber(ARGV[3])

-- 参数校验
if not maxConcurrency or maxConcurrency < 0 then
    return -1
end

-- 获取当前并发数
local current = tonumber(redis.call('GET', key))
if not current then
    current = 0
end

if operation == 'acquire' then
    -- maxConcurrency=0 表示无限制
    if maxConcurrency == 0 then
        local newCount = current + 1
        redis.call('SET', key, newCount, 'EX', expireTime)
        return 1
    end

    -- 检查是否超过限制
    if current >= maxConcurrency then
        return 0
    end

    -- 获取槽位成功，增加计数
    local newCount = current + 1
    redis.call('SET', key, newCount, 'EX', expireTime)
    return 1

elseif operation == 'release' then
    -- 释放槽位
    if current > 0 then
        local newCount = current - 1
        if newCount == 0 then
            redis.call('DEL', key)
        else
            redis.call('SET', key, newCount, 'EX', expireTime)
        end
        return newCount
    end
    return 0
end

return -1
