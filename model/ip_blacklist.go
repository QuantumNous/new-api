package model

import (
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// IpBlacklist stores client IPs auto-banned for repeated invalid API key probes.
// Entries persist until an administrator removes them.
type IpBlacklist struct {
	Id        int    `json:"id"`
	Ip        string `json:"ip" gorm:"type:varchar(64);uniqueIndex;not null"`
	Reason    string `json:"reason" gorm:"type:varchar(255);default:''"`
	HitCount  int    `json:"hit_count" gorm:"default:0"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

var (
	ipBlacklistCache   sync.Map // ip -> struct{}
	ipBlacklistCacheMu sync.Mutex
)

func LoadIpBlacklistCache() error {
	if DB == nil {
		return nil
	}
	var rows []IpBlacklist
	if err := DB.Select("ip").Find(&rows).Error; err != nil {
		return err
	}
	next := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		ip := strings.TrimSpace(row.Ip)
		if ip != "" {
			next[ip] = struct{}{}
		}
	}
	ipBlacklistCacheMu.Lock()
	defer ipBlacklistCacheMu.Unlock()
	ipBlacklistCache.Range(func(key, _ any) bool {
		ipBlacklistCache.Delete(key)
		return true
	})
	for ip := range next {
		ipBlacklistCache.Store(ip, struct{}{})
	}
	return nil
}

func IsIpBlacklisted(ip string) bool {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return false
	}
	_, ok := ipBlacklistCache.Load(ip)
	return ok
}

func AddIpToBlacklist(ip string, reason string, hitCount int) (*IpBlacklist, error) {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return nil, fmt.Errorf("ip is empty")
	}
	if hitCount < 0 {
		hitCount = 0
	}
	now := common.GetTimestamp()
	entry := &IpBlacklist{
		Ip:        ip,
		Reason:    reason,
		HitCount:  hitCount,
		CreatedAt: now,
	}
	// Idempotent: keep the first ban row, refresh hit_count/reason if already present.
	var existing IpBlacklist
	err := DB.Where("ip = ?", ip).First(&existing).Error
	if err == nil {
		updates := map[string]any{
			"hit_count": hitCount,
		}
		if reason != "" {
			updates["reason"] = reason
		}
		if err := DB.Model(&existing).Updates(updates).Error; err != nil {
			return nil, err
		}
		existing.HitCount = hitCount
		if reason != "" {
			existing.Reason = reason
		}
		ipBlacklistCache.Store(ip, struct{}{})
		return &existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err := DB.Create(entry).Error; err != nil {
		return nil, err
	}
	ipBlacklistCache.Store(ip, struct{}{})
	return entry, nil
}

func RemoveIpFromBlacklist(id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid id")
	}
	var entry IpBlacklist
	if err := DB.First(&entry, id).Error; err != nil {
		return err
	}
	if err := DB.Delete(&IpBlacklist{}, id).Error; err != nil {
		return err
	}
	ipBlacklistCache.Delete(entry.Ip)
	return nil
}

func GetIpBlacklistPage(startIdx int, num int) ([]*IpBlacklist, int64, error) {
	var total int64
	if err := DB.Model(&IpBlacklist{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []*IpBlacklist
	err := DB.Order("id desc").Limit(num).Offset(startIdx).Find(&rows).Error
	return rows, total, err
}

func SearchIpBlacklist(keyword string, startIdx int, num int) ([]*IpBlacklist, int64, error) {
	keyword = strings.TrimSpace(keyword)
	tx := DB.Model(&IpBlacklist{})
	if keyword != "" {
		tx = tx.Where("ip LIKE ?", "%"+keyword+"%")
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []*IpBlacklist
	err := tx.Order("id desc").Limit(num).Offset(startIdx).Find(&rows).Error
	return rows, total, err
}

// EnsureIpBlacklistLoaded reloads the cache when empty (e.g. after process start race).
func EnsureIpBlacklistLoaded() {
	loaded := false
	ipBlacklistCache.Range(func(_, _ any) bool {
		loaded = true
		return false
	})
	if loaded {
		return
	}
	_ = LoadIpBlacklistCache()
}
