package model

import (
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// 工单未读计数的 Redis 缓存层（设计文档 §10.2 ③）。
// 自适应：有 Redis 走缓存，无 Redis（或读写出错）一律回退直查 DB——不引入硬依赖。
// 新鲜度靠"写时失效"（invalidate*），TTL 仅作兜底防漏失效。

const (
	feedbackUnreadTTL      = 60 * time.Second
	feedbackAdminUnreadKey = "feedback:unread:admin"
)

func feedbackUserUnreadKey(userId int) string {
	return fmt.Sprintf("feedback:unread:user:%d", userId)
}

// GetUserUnreadCount 我的未读未关闭工单数（缓存优先，缺失/出错回退 DB 并回种）。
func GetUserUnreadCount(userId int) int64 {
	if !common.RedisEnabled {
		return countUserUnread(userId)
	}
	key := feedbackUserUnreadKey(userId)
	if val, err := common.RedisGet(key); err == nil {
		if n, perr := strconv.ParseInt(val, 10, 64); perr == nil {
			return n
		}
	}
	count := countUserUnread(userId)
	_ = common.RedisSet(key, strconv.FormatInt(count, 10), feedbackUnreadTTL)
	return count
}

// GetAdminUnreadCount 全局未读未关闭工单数（缓存优先，缺失/出错回退 DB 并回种）。
func GetAdminUnreadCount() int64 {
	if !common.RedisEnabled {
		return countAdminUnread()
	}
	if val, err := common.RedisGet(feedbackAdminUnreadKey); err == nil {
		if n, perr := strconv.ParseInt(val, 10, 64); perr == nil {
			return n
		}
	}
	count := countAdminUnread()
	_ = common.RedisSet(feedbackAdminUnreadKey, strconv.FormatInt(count, 10), feedbackUnreadTTL)
	return count
}

// invalidateUserUnreadCache 写时失效：删某用户的未读缓存。
func invalidateUserUnreadCache(userId int) {
	if common.RedisEnabled {
		_ = common.RedisDel(feedbackUserUnreadKey(userId))
	}
}

// invalidateAdminUnreadCache 写时失效：删全局未读缓存。
func invalidateAdminUnreadCache() {
	if common.RedisEnabled {
		_ = common.RedisDel(feedbackAdminUnreadKey)
	}
}
