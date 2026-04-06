package model

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
)

// UserActiveIP 用户活跃 IP 汇总表（从日志中提取的去重 IP）
type UserActiveIP struct {
	Id     int    `json:"id" gorm:"primaryKey"`
	UserId int    `json:"user_id" gorm:"uniqueIndex:idx_user_active_ip"`
	Ip     string `json:"ip" gorm:"type:varchar(64);uniqueIndex:idx_user_active_ip;index:idx_active_ip"`
}

func (UserActiveIP) TableName() string {
	return "user_active_ips"
}

const activeIPRedisKey = "queue:active_ip"

// 内存去重缓存，避免对已知 (user_id, ip) 重复写库/推队列
var (
	activeIPCache     = make(map[string]bool)
	activeIPCacheLock sync.RWMutex
)

func activeIPCacheKey(userId int, ip string) string {
	return strconv.Itoa(userId) + ":" + ip
}

// PublishActiveIP 将活跃 IP 推送到 Redis 队列（或直接写库）
func PublishActiveIP(userId int, ip string) {
	if ip == "" || userId == 0 {
		return
	}

	key := activeIPCacheKey(userId, ip)

	// 内存快速去重
	activeIPCacheLock.RLock()
	exists := activeIPCache[key]
	activeIPCacheLock.RUnlock()
	if exists {
		return
	}

	if common.RedisEnabled {
		// 推入 Redis List 队列
		ctx := context.Background()
		err := common.RDB.LPush(ctx, activeIPRedisKey, key).Err()
		if err != nil {
			common.SysError("failed to push active IP to redis: " + err.Error())
			// fallback: 直接写库
			gopool.Go(func() {
				recordActiveIP(userId, ip)
			})
			return
		}
		// 提前写入内存缓存，避免重复推送
		activeIPCacheLock.Lock()
		activeIPCache[key] = true
		activeIPCacheLock.Unlock()
	} else {
		// Redis 未启用，直接异步写库
		gopool.Go(func() {
			recordActiveIP(userId, ip)
		})
	}
}

// recordActiveIP 实际写库逻辑（幂等，唯一索引去重）
func recordActiveIP(userId int, ip string) {
	record := UserActiveIP{UserId: userId, Ip: ip}
	result := DB.Where("user_id = ? AND ip = ?", userId, ip).FirstOrCreate(&record)
	if result.Error != nil {
		common.SysError("failed to record active IP: " + result.Error.Error())
		return
	}

	// 写入内存缓存
	activeIPCacheLock.Lock()
	activeIPCache[activeIPCacheKey(userId, ip)] = true
	activeIPCacheLock.Unlock()
}

// StartActiveIPConsumer 启动 Redis 队列消费者（后台长驻 goroutine）
func StartActiveIPConsumer() {
	if !common.RedisEnabled {
		common.SysLog("Redis not enabled, active IP consumer not started")
		return
	}
	common.SysLog("active IP consumer started")

	gopool.Go(func() {
		for {
			consumeActiveIPBatch()
		}
	})
}

func consumeActiveIPBatch() {
	defer func() {
		if r := recover(); r != nil {
			common.SysError("active IP consumer panic recovered")
			time.Sleep(time.Second)
		}
	}()

	ctx := context.Background()

	// BRPOP 阻塞等待，超时 5 秒
	result, err := common.RDB.BRPop(ctx, 5*time.Second, activeIPRedisKey).Result()
	if err != nil {
		// 超时是正常的，不需要打日志
		return
	}

	// result[0] = key name, result[1] = value
	if len(result) < 2 {
		return
	}

	processActiveIPMessage(result[1])

	// 非阻塞批量消费剩余消息（一次最多处理 100 条）
	for i := 0; i < 100; i++ {
		val, err := common.RDB.RPop(ctx, activeIPRedisKey).Result()
		if err != nil {
			break // 队列空了
		}
		processActiveIPMessage(val)
	}
}

func processActiveIPMessage(msg string) {
	// msg 格式: "userId:ip"
	parts := strings.SplitN(msg, ":", 2)
	if len(parts) != 2 {
		return
	}
	userId, err := strconv.Atoi(parts[0])
	if err != nil || userId == 0 {
		return
	}
	ip := parts[1]
	if ip == "" {
		return
	}
	recordActiveIP(userId, ip)
}

// FillActiveIPs 批量查询用户的历史活跃 IP（从汇总表查询）
func FillActiveIPs(users []*User) {
	if len(users) == 0 {
		return
	}

	userIDs := make([]int, 0, len(users))
	for _, u := range users {
		userIDs = append(userIDs, u.Id)
	}

	var results []UserActiveIP
	err := DB.Where("user_id IN ?", userIDs).Find(&results).Error
	if err != nil {
		common.SysError("failed to query active IPs: " + err.Error())
		return
	}

	ipMap := make(map[int][]string)
	for _, r := range results {
		ipMap[r.UserId] = append(ipMap[r.UserId], r.Ip)
	}

	for _, u := range users {
		if ips, ok := ipMap[u.Id]; ok {
			u.ActiveIPs = ips
		}
	}
}

// SearchUserIDsByIP 从汇总表搜索使用过指定 IP 的用户 ID 列表
func SearchUserIDsByIP(ip string) ([]int, error) {
	var userIDs []int
	err := DB.Model(&UserActiveIP{}).
		Select("DISTINCT user_id").
		Where("ip = ?", ip).
		Find(&userIDs).Error
	if err != nil {
		common.SysError("failed to search user IDs by IP: " + err.Error())
		return nil, err
	}
	return userIDs, nil
}

// InitActiveIPCache 启动时从数据库预热内存缓存
func InitActiveIPCache() {
	var records []UserActiveIP
	err := DB.Select("user_id, ip").Find(&records).Error
	if err != nil {
		common.SysError("failed to init active IP cache: " + err.Error())
		return
	}
	activeIPCacheLock.Lock()
	for _, r := range records {
		activeIPCache[activeIPCacheKey(r.UserId, r.Ip)] = true
	}
	activeIPCacheLock.Unlock()
	common.SysLog("active IP cache initialized with " + strconv.Itoa(len(records)) + " records")
}

