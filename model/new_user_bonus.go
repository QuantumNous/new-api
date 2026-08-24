package model

import (
	"context"
	"fmt"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	maxNewUserBonusClaimsPerRegistrationIP = 2
	newUserBonusRegistrationIPWindow       = 7 * 24 * time.Hour
	newUserBonusRegistrationIPRedisKeyPref = "new-api:new_user_bonus:registration_ip:"
)

var newUserBonusRegistrationIPRedisClaimScript = redis.NewScript(`
local key = KEYS[1]
local window = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local member = ARGV[3]

local redis_time = redis.call('TIME')
local now = tonumber(redis_time[1])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

if redis.call('ZSCORE', key, member) then
	redis.call('EXPIRE', key, window)
	return 1
end

if redis.call('ZCARD', key) >= max then
	redis.call('EXPIRE', key, window)
	return 0
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, window)
return 1
`)

type NewUserBonusClaim struct {
	Id             int    `json:"id"`
	RegistrationIP string `json:"registration_ip" gorm:"type:varchar(64);uniqueIndex:idx_new_user_bonus_ip_slot;index"`
	Slot           int    `json:"slot" gorm:"uniqueIndex:idx_new_user_bonus_ip_slot"`
	UserId         int    `json:"user_id" gorm:"uniqueIndex"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

func normalizeRegistrationIP(registrationIP string) string {
	registrationIP = strings.TrimSpace(registrationIP)
	if registrationIP == "" {
		return ""
	}
	addr, err := netip.ParseAddr(registrationIP)
	if err != nil {
		return registrationIP
	}
	return addr.Unmap().String()
}

func prepareMissingRegistrationIPNewUserBonus(user *User) {
	user.Quota = 0
	user.NewUserBonusGiven = false
}

func grantNewUserBonusInTx(tx *gorm.DB, user *User) error {
	user.Quota = common.QuotaForNewUser
	user.NewUserBonusGiven = true
	return tx.Model(&User{}).
		Where("id = ?", user.Id).
		Updates(map[string]any{
			"quota":                user.Quota,
			"new_user_bonus_given": user.NewUserBonusGiven,
		}).Error
}

func claimRegistrationIPNewUserBonusInTx(tx *gorm.DB, user *User) error {
	if common.QuotaForNewUser <= 0 || user == nil || user.Id == 0 || user.RegistrationIP == "" {
		return nil
	}
	if common.RedisEnabled && common.RDB != nil {
		claimed, err := claimRegistrationIPNewUserBonusInRedis(context.Background(), user)
		if err != nil {
			common.SysError("claim new user bonus in redis failed: " + err.Error())
			return nil
		}
		if !claimed {
			return nil
		}
		if err := grantNewUserBonusInTx(tx, user); err != nil {
			releaseRegistrationIPNewUserBonusRedisClaim(context.Background(), user)
			return err
		}
		return nil
	}
	return claimRegistrationIPNewUserBonusInDBInTx(tx, user)
}

func claimRegistrationIPNewUserBonusInRedis(ctx context.Context, user *User) (bool, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if common.RDB == nil {
		return false, fmt.Errorf("redis client is nil")
	}
	result, err := newUserBonusRegistrationIPRedisClaimScript.Run(
		ctx,
		common.RDB,
		[]string{newUserBonusRegistrationIPRedisKey(user.RegistrationIP)},
		int64(newUserBonusRegistrationIPWindow/time.Second),
		maxNewUserBonusClaimsPerRegistrationIP,
		strconv.Itoa(user.Id),
	).Int()
	if err != nil {
		return false, fmt.Errorf("claim registration IP bonus slot: %w", err)
	}
	return result == 1, nil
}

func releaseRegistrationIPNewUserBonusRedisClaim(ctx context.Context, user *User) {
	if user == nil || user.Id == 0 || user.RegistrationIP == "" || common.RDB == nil {
		return
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if err := common.RDB.ZRem(ctx, newUserBonusRegistrationIPRedisKey(user.RegistrationIP), strconv.Itoa(user.Id)).Err(); err != nil {
		common.SysError("release new user bonus redis claim failed: " + err.Error())
	}
}

// ReleaseRegistrationIPNewUserBonusRedisClaim releases a Redis bonus slot when user creation rolls back.
func ReleaseRegistrationIPNewUserBonusRedisClaim(user *User) {
	releaseRegistrationIPNewUserBonusRedisClaim(context.Background(), user)
}

func newUserBonusRegistrationIPRedisKey(registrationIP string) string {
	return newUserBonusRegistrationIPRedisKeyPref + registrationIP
}

func claimRegistrationIPNewUserBonusInDBInTx(tx *gorm.DB, user *User) error {
	now := common.GetTimestamp()
	windowStart := now - int64(newUserBonusRegistrationIPWindow/time.Second)
	for slot := 1; slot <= maxNewUserBonusClaimsPerRegistrationIP; slot++ {
		claim := NewUserBonusClaim{
			RegistrationIP: user.RegistrationIP,
			Slot:           slot,
			UserId:         user.Id,
			CreatedAt:      now,
		}
		insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&claim)
		if insert.Error != nil {
			return insert.Error
		}
		if insert.RowsAffected > 0 {
			return grantNewUserBonusInTx(tx, user)
		}

		refresh := tx.Model(&NewUserBonusClaim{}).
			Where("registration_ip = ? AND slot = ? AND created_at <= ?", user.RegistrationIP, slot, windowStart).
			Updates(map[string]any{
				"user_id":    user.Id,
				"created_at": now,
			})
		if refresh.Error != nil {
			return refresh.Error
		}
		if refresh.RowsAffected > 0 {
			return grantNewUserBonusInTx(tx, user)
		}
	}
	return nil
}
