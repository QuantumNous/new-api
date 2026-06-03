package service

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type SMSRateLimitInput struct {
	Phone     string
	IP        string
	AccountID string
	Scene     string
}

type SMSRateLimitConfig struct {
	Enabled       bool
	WindowSeconds int
	PhoneCount    int
	IPCount       int
	AccountCount  int
	SceneCount    int
}

type SMSRateLimiter struct {
	mutex sync.Mutex
	store map[string][]int64
	now   func() int64
}

type smsRateLimitRule struct {
	dimension string
	key       string
	maxCount  int
}

var defaultSMSRateLimiter = NewSMSRateLimiter()

func NewSMSRateLimiter() *SMSRateLimiter {
	return &SMSRateLimiter{
		store: make(map[string][]int64),
		now: func() int64 {
			return time.Now().Unix()
		},
	}
}

func ResetSMSRateLimiterForTest() {
	defaultSMSRateLimiter = NewSMSRateLimiter()
}

func CheckSMSRateLimit(input SMSRateLimitInput) error {
	return defaultSMSRateLimiter.Check(input, DefaultSMSRateLimitConfig())
}

func CheckSMSRateLimitWithDB(db *gorm.DB, input SMSRateLimitInput, config SMSRateLimitConfig) error {
	if db == nil {
		return defaultSMSRateLimiter.Check(input, config)
	}
	if !config.Enabled {
		return nil
	}
	windowSeconds := normalizeSMSRateLimitWindowSeconds(config.WindowSeconds)
	rules, err := buildSMSRateLimitRules(input, config)
	if err != nil {
		return err
	}
	if len(rules) == 0 {
		return nil
	}
	return checkSMSRateLimitRulesWithDB(db, rules, windowSeconds, time.Now().Unix())
}

func DefaultSMSRateLimitConfig() SMSRateLimitConfig {
	return SMSRateLimitConfig{
		Enabled:       common.SMSRateLimitEnabled,
		WindowSeconds: common.SMSRateLimitWindowSeconds,
		PhoneCount:    common.SMSRateLimitPhoneCount,
		IPCount:       common.SMSRateLimitIPCount,
		AccountCount:  common.SMSRateLimitAccountCount,
		SceneCount:    common.SMSRateLimitSceneCount,
	}
}

func (limiter *SMSRateLimiter) Check(input SMSRateLimitInput, config SMSRateLimitConfig) error {
	if limiter == nil || !config.Enabled {
		return nil
	}
	windowSeconds := normalizeSMSRateLimitWindowSeconds(config.WindowSeconds)
	rules, err := buildSMSRateLimitRules(input, config)
	if err != nil {
		return err
	}
	if len(rules) == 0 {
		return nil
	}

	limiter.mutex.Lock()
	defer limiter.mutex.Unlock()

	now := limiter.now()
	cutoff := now - int64(windowSeconds)
	for _, rule := range rules {
		limiter.store[rule.key] = pruneSMSRateLimitHits(limiter.store[rule.key], cutoff)
		if len(limiter.store[rule.key]) >= rule.maxCount {
			return fmt.Errorf("sms rate limit exceeded: %s", rule.dimension)
		}
	}
	for _, rule := range rules {
		limiter.store[rule.key] = append(limiter.store[rule.key], now)
	}
	return nil
}

func checkSMSRateLimitRulesWithDB(db *gorm.DB, rules []smsRateLimitRule, windowSeconds int, now int64) error {
	windowStart := now - now%int64(windowSeconds)
	expiresAt := windowStart + int64(windowSeconds)

	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("expires_at <= ?", now).Delete(&model.SMSRateLimitCounter{}).Error; err != nil {
			return err
		}
		for _, rule := range rules {
			counter, err := findSMSRateLimitCounter(tx, hashSMSRateLimitKey(rule.key), windowStart)
			if err != nil {
				return err
			}
			if counter != nil && counter.Count >= rule.maxCount {
				return fmt.Errorf("sms rate limit exceeded: %s", rule.dimension)
			}
		}
		for _, rule := range rules {
			keyHash := hashSMSRateLimitKey(rule.key)
			counter, err := findSMSRateLimitCounter(tx, keyHash, windowStart)
			if err != nil {
				return err
			}
			if counter == nil {
				counter = &model.SMSRateLimitCounter{
					Dimension:     rule.dimension,
					Scene:         smsRateLimitRuleScene(rule.key),
					RateKeyHash:   keyHash,
					WindowStart:   windowStart,
					WindowSeconds: windowSeconds,
					Count:         1,
					ExpiresAt:     expiresAt,
				}
				if err := tx.Create(counter).Error; err != nil {
					return err
				}
				continue
			}
			if err := tx.Model(&model.SMSRateLimitCounter{}).
				Where("id = ?", counter.Id).
				Updates(map[string]interface{}{
					"count":          counter.Count + 1,
					"window_seconds": windowSeconds,
					"expires_at":     expiresAt,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func findSMSRateLimitCounter(db *gorm.DB, keyHash string, windowStart int64) (*model.SMSRateLimitCounter, error) {
	var counter model.SMSRateLimitCounter
	result := db.Where("rate_key_hash = ? AND window_start = ?", keyHash, windowStart).
		Limit(1).
		Find(&counter)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &counter, nil
}

func normalizeSMSRateLimitWindowSeconds(windowSeconds int) int {
	if windowSeconds <= 0 {
		windowSeconds = common.SMSRateLimitWindowSeconds
	}
	if windowSeconds <= 0 {
		windowSeconds = 60
	}
	return windowSeconds
}

func hashSMSRateLimitKey(key string) string {
	digest := sha256.Sum256([]byte("sms_rate_limit:" + key))
	return fmt.Sprintf("%x", digest)
}

func smsRateLimitRuleScene(key string) string {
	parts := strings.Split(key, ":")
	if len(parts) >= 3 {
		return parts[2]
	}
	return "default"
}

func buildSMSRateLimitRules(input SMSRateLimitInput, config SMSRateLimitConfig) ([]smsRateLimitRule, error) {
	scene := strings.TrimSpace(input.Scene)
	if scene == "" {
		scene = "default"
	}
	rules := make([]smsRateLimitRule, 0, 4)
	if config.PhoneCount > 0 && strings.TrimSpace(input.Phone) != "" {
		phone, err := common.NormalizePhone(input.Phone)
		if err != nil {
			return nil, err
		}
		rules = append(rules, smsRateLimitRule{
			dimension: "phone",
			key:       "sms:phone:" + scene + ":" + phone,
			maxCount:  config.PhoneCount,
		})
	}
	if config.IPCount > 0 && strings.TrimSpace(input.IP) != "" {
		rules = append(rules, smsRateLimitRule{
			dimension: "ip",
			key:       "sms:ip:" + scene + ":" + strings.TrimSpace(input.IP),
			maxCount:  config.IPCount,
		})
	}
	if config.AccountCount > 0 && strings.TrimSpace(input.AccountID) != "" {
		rules = append(rules, smsRateLimitRule{
			dimension: "account",
			key:       "sms:account:" + scene + ":" + strings.TrimSpace(input.AccountID),
			maxCount:  config.AccountCount,
		})
	}
	if config.SceneCount > 0 {
		rules = append(rules, smsRateLimitRule{
			dimension: "scene",
			key:       "sms:scene:" + scene,
			maxCount:  config.SceneCount,
		})
	}
	return rules, nil
}

func pruneSMSRateLimitHits(hits []int64, cutoff int64) []int64 {
	firstActive := 0
	for firstActive < len(hits) && hits[firstActive] <= cutoff {
		firstActive++
	}
	if firstActive == 0 {
		return hits
	}
	return hits[firstActive:]
}
