package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	invalidKeyIPFailNamespace = "authFail:invalidKey:ip"
	invalidKeyIPFailWindowSec = int64(24 * 60 * 60)
)

var (
	invalidKeyIPMemoryMu     sync.Mutex
	invalidKeyIPMemoryCounts = map[string]*invalidKeyIPMemoryEntry{}
)

type invalidKeyIPMemoryEntry struct {
	count     int
	expiresAt time.Time
}

// RecordInvalidKeyIPFailure increments the per-IP invalid-key counter for a
// rolling 24h window. When the count reaches InvalidKeyIPBanThreshold the IP
// is added to the persistent blacklist.
func RecordInvalidKeyIPFailure(c *gin.Context) {
	if c == nil {
		return
	}
	ip := strings.TrimSpace(c.ClientIP())
	if ip == "" || ip == "127.0.0.1" || ip == "::1" {
		// Never auto-ban loopback; local/dev probes should not lock out the host.
		return
	}
	model.EnsureIpBlacklistLoaded()
	if model.IsIpBlacklisted(ip) {
		return
	}
	count, err := incrementInvalidKeyIPFailure(c.Request.Context(), ip)
	if err != nil {
		logger.LogError(c, "invalid key IP counter failed: "+err.Error())
		return
	}
	threshold := constant.InvalidKeyIPBanThreshold
	if threshold <= 0 {
		threshold = 10
	}
	if count < threshold {
		return
	}
	reason := fmt.Sprintf("auto-ban: %d invalid API key attempts within 24h", count)
	if _, err := model.AddIpToBlacklist(ip, reason, count); err != nil {
		logger.LogError(c, "failed to blacklist IP "+ip+": "+err.Error())
		return
	}
	logger.LogWarn(c, fmt.Sprintf("IP %s auto-blacklisted after %d invalid API key attempts", ip, count))
}

func incrementInvalidKeyIPFailure(ctx context.Context, ip string) (int, error) {
	if common.RedisEnabled && common.RDB != nil {
		key := fmt.Sprintf("%s:%s", invalidKeyIPFailNamespace, ip)
		count, err := common.RDB.Incr(ctx, key).Result()
		if err != nil {
			return 0, err
		}
		if count == 1 {
			if err := common.RDB.Expire(ctx, key, time.Duration(invalidKeyIPFailWindowSec)*time.Second).Err(); err != nil {
				return int(count), err
			}
		}
		return int(count), nil
	}
	return incrementInvalidKeyIPFailureMemory(ip), nil
}

func incrementInvalidKeyIPFailureMemory(ip string) int {
	invalidKeyIPMemoryMu.Lock()
	defer invalidKeyIPMemoryMu.Unlock()
	now := time.Now()
	entry, ok := invalidKeyIPMemoryCounts[ip]
	if !ok || now.After(entry.expiresAt) {
		entry = &invalidKeyIPMemoryEntry{
			count:     0,
			expiresAt: now.Add(time.Duration(invalidKeyIPFailWindowSec) * time.Second),
		}
		invalidKeyIPMemoryCounts[ip] = entry
	}
	entry.count++
	return entry.count
}

// ResetInvalidKeyIPFailureMemoryForTest clears in-memory counters (tests only).
func ResetInvalidKeyIPFailureMemoryForTest() {
	invalidKeyIPMemoryMu.Lock()
	defer invalidKeyIPMemoryMu.Unlock()
	invalidKeyIPMemoryCounts = map[string]*invalidKeyIPMemoryEntry{}
}
