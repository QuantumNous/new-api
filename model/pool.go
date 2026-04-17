package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	PoolStatusEnabled  = 1
	PoolStatusDisabled = 2
)

const (
	PoolBindingTypeToken            = "token"
	PoolBindingTypeUser             = "user"
	PoolBindingTypeGroup            = "group"
	PoolBindingTypeDefault          = "default"
	PoolBindingTypeSubscriptionPlan = "subscription_plan"
)

const (
	PoolQuotaMetricRequestCount = "request_count"
	PoolQuotaScopeUser          = "user"
	PoolQuotaScopeToken         = "token"
)

type Pool struct {
	Id          int    `json:"id"`
	Name        string `json:"name" gorm:"type:varchar(64);uniqueIndex;not null"`
	Description string `json:"description" gorm:"type:varchar(255);default:''"`
	Status      int    `json:"status" gorm:"default:1;index"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

type PoolChannel struct {
	Id        int   `json:"id"`
	PoolId    int   `json:"pool_id" gorm:"index:idx_pool_channel,priority:1;uniqueIndex:uk_pool_channel,priority:1"`
	ChannelId int   `json:"channel_id" gorm:"index:idx_pool_channel,priority:2;uniqueIndex:uk_pool_channel,priority:2"`
	Weight    int   `json:"weight" gorm:"default:0"`
	Priority  int64 `json:"priority" gorm:"bigint;default:0"`
	Enabled   bool  `json:"enabled" gorm:"default:true;index"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

type PoolQuotaPolicy struct {
	Id            int    `json:"id"`
	PoolId        int    `json:"pool_id" gorm:"index:idx_pool_quota_policy,priority:1;uniqueIndex:uk_pool_quota_policy,priority:1"`
	Metric        string `json:"metric" gorm:"type:varchar(32);index:idx_pool_quota_policy,priority:2;uniqueIndex:uk_pool_quota_policy,priority:2"`
	ScopeType     string `json:"scope_type" gorm:"type:varchar(32);index:idx_pool_quota_policy,priority:3;uniqueIndex:uk_pool_quota_policy,priority:3"`
	WindowSeconds int    `json:"window_seconds" gorm:"default:0;index:idx_pool_quota_policy,priority:4;uniqueIndex:uk_pool_quota_policy,priority:4"`
	LimitCount    int    `json:"limit_count" gorm:"default:0"`
	Enabled       bool   `json:"enabled" gorm:"default:true;index"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`
}

type PoolBinding struct {
	Id           int    `json:"id"`
	BindingType  string `json:"binding_type" gorm:"type:varchar(32);index:idx_pool_binding,priority:1"`
	BindingValue string `json:"binding_value" gorm:"type:varchar(128);index:idx_pool_binding,priority:2"`
	PoolId       int    `json:"pool_id" gorm:"index"`
	Priority     int    `json:"priority" gorm:"default:0;index"`
	Enabled      bool   `json:"enabled" gorm:"default:true;index"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint"`
}

func (p *Pool) BeforeCreate(tx *gorm.DB) error {
	if p.CreatedAt == 0 {
		p.CreatedAt = common.GetTimestamp()
	}
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *Pool) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *PoolChannel) BeforeCreate(tx *gorm.DB) error {
	if p.CreatedAt == 0 {
		p.CreatedAt = common.GetTimestamp()
	}
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *PoolChannel) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *PoolQuotaPolicy) BeforeCreate(tx *gorm.DB) error {
	if p.CreatedAt == 0 {
		p.CreatedAt = common.GetTimestamp()
	}
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *PoolQuotaPolicy) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *PoolBinding) BeforeCreate(tx *gorm.DB) error {
	if p.CreatedAt == 0 {
		p.CreatedAt = common.GetTimestamp()
	}
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *PoolBinding) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func GetPoolById(poolId int) (*Pool, error) {
	if poolId <= 0 {
		return nil, nil
	}
	pool := &Pool{}
	err := DB.Where("id = ? AND status = ?", poolId, PoolStatusEnabled).First(pool).Error
	if err != nil {
		return nil, err
	}
	return pool, nil
}

func GetDefaultPool() (*Pool, error) {
	pool := &Pool{}
	err := DB.Where("status = ?", PoolStatusEnabled).Order("id ASC").First(pool).Error
	if err != nil {
		return nil, err
	}
	return pool, nil
}

func resolvePoolByBindingType(bindingType string, bindingValue string) (*Pool, error) {
	bindings := make([]*PoolBinding, 0)
	query := DB.Where("enabled = ? AND binding_type = ?", true, bindingType)
	if bindingType != PoolBindingTypeDefault {
		query = query.Where("binding_value = ?", bindingValue)
	}
	if err := query.Order("priority DESC, id ASC").Find(&bindings).Error; err != nil {
		return nil, err
	}
	for _, binding := range bindings {
		pool, err := GetPoolById(binding.PoolId)
		if err == nil && pool != nil {
			return pool, nil
		}
	}
	return nil, nil
}

func ResolvePoolForContext(userId int, tokenId int, usingGroup string) (*Pool, error) {
	if tokenId > 0 {
		pool, err := resolvePoolByBindingType(PoolBindingTypeToken, strconv.Itoa(tokenId))
		if err != nil {
			return nil, err
		}
		if pool != nil {
			return pool, nil
		}
	}
	if userId > 0 {
		pool, err := resolvePoolByBindingType(PoolBindingTypeUser, strconv.Itoa(userId))
		if err != nil {
			return nil, err
		}
		if pool != nil {
			return pool, nil
		}
	}
	if usingGroup != "" {
		pool, err := resolvePoolByBindingType(PoolBindingTypeGroup, usingGroup)
		if err != nil {
			return nil, err
		}
		if pool != nil {
			return pool, nil
		}
	}
	pool, err := resolvePoolByBindingType(PoolBindingTypeDefault, "")
	if err != nil {
		return nil, err
	}
	if pool != nil {
		return pool, nil
	}
	return GetDefaultPool()
}

func ResolvePoolForUser(userId int, usingGroup string) (*Pool, error) {
	return ResolvePoolForContext(userId, 0, usingGroup)
}

func FilterChannelIDsByPool(poolId int, channelIDs []int) ([]int, error) {
	if poolId <= 0 || len(channelIDs) == 0 {
		return channelIDs, nil
	}
	poolChannelIDs := make([]int, 0)
	err := DB.Model(&PoolChannel{}).
		Where("pool_id = ? AND enabled = ? AND channel_id IN ?", poolId, true, channelIDs).
		Pluck("channel_id", &poolChannelIDs).Error
	if err != nil {
		return nil, err
	}
	if len(poolChannelIDs) == 0 {
		return []int{}, nil
	}
	allowed := make(map[int]struct{}, len(poolChannelIDs))
	for _, id := range poolChannelIDs {
		allowed[id] = struct{}{}
	}
	filtered := make([]int, 0, len(channelIDs))
	for _, id := range channelIDs {
		if _, ok := allowed[id]; ok {
			filtered = append(filtered, id)
		}
	}
	return filtered, nil
}

func IsChannelInPool(poolId, channelId int) (bool, error) {
	if poolId <= 0 || channelId <= 0 {
		return false, nil
	}
	count := int64(0)
	err := DB.Model(&PoolChannel{}).
		Where("pool_id = ? AND channel_id = ? AND enabled = ?", poolId, channelId, true).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func GetPoolQuotaPolicies(poolId int, metric string, scopeType string) ([]*PoolQuotaPolicy, error) {
	policies := make([]*PoolQuotaPolicy, 0)
	query := DB.Where("pool_id = ? AND enabled = ?", poolId, true)
	if metric != "" {
		query = query.Where("metric = ?", metric)
	}
	if scopeType != "" {
		query = query.Where("scope_type = ?", scopeType)
	}
	err := query.Order("window_seconds ASC, id ASC").Find(&policies).Error
	if err != nil {
		return nil, err
	}
	return policies, nil
}

func GetPools(offset, limit int) ([]*Pool, int64, error) {
	pools := make([]*Pool, 0)
	total := int64(0)
	query := DB.Model(&Pool{})
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if limit > 0 {
		query = query.Limit(limit).Offset(offset)
	}
	if err := query.Order("id DESC").Find(&pools).Error; err != nil {
		return nil, 0, err
	}
	return pools, total, nil
}

func CreatePool(pool *Pool) error {
	if pool == nil {
		return errors.New("pool is nil")
	}
	return DB.Create(pool).Error
}

func UpdatePool(pool *Pool) error {
	if pool == nil || pool.Id <= 0 {
		return errors.New("invalid pool")
	}
	return DB.Model(&Pool{}).Where("id = ?", pool.Id).Updates(map[string]interface{}{
		"name":        pool.Name,
		"description": pool.Description,
		"status":      pool.Status,
		"updated_at":  common.GetTimestamp(),
	}).Error
}

func DeletePool(poolId int) error {
	if poolId <= 0 {
		return errors.New("invalid pool id")
	}
	return DB.Where("id = ?", poolId).Delete(&Pool{}).Error
}

func GetPoolChannels(poolId int, offset, limit int) ([]*PoolChannel, int64, error) {
	items := make([]*PoolChannel, 0)
	total := int64(0)
	query := DB.Model(&PoolChannel{})
	if poolId > 0 {
		query = query.Where("pool_id = ?", poolId)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if limit > 0 {
		query = query.Limit(limit).Offset(offset)
	}
	if err := query.Order("id DESC").Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func CreatePoolChannel(item *PoolChannel) error {
	if item == nil {
		return errors.New("pool channel is nil")
	}
	return DB.Create(item).Error
}

func UpdatePoolChannel(item *PoolChannel) error {
	if item == nil || item.Id <= 0 {
		return errors.New("invalid pool channel")
	}
	return DB.Model(&PoolChannel{}).Where("id = ?", item.Id).Updates(map[string]interface{}{
		"pool_id":    item.PoolId,
		"channel_id": item.ChannelId,
		"weight":     item.Weight,
		"priority":   item.Priority,
		"enabled":    item.Enabled,
		"updated_at": common.GetTimestamp(),
	}).Error
}

func DeletePoolChannel(id int) error {
	if id <= 0 {
		return errors.New("invalid pool channel id")
	}
	return DB.Where("id = ?", id).Delete(&PoolChannel{}).Error
}

func GetPoolBindings(bindingType, bindingValue, bindingName string, offset, limit int) ([]*PoolBinding, int64, error) {
	items := make([]*PoolBinding, 0)
	total := int64(0)
	query := DB.Model(&PoolBinding{})
	if bindingType != "" {
		query = query.Where("binding_type = ?", bindingType)
	}
	if bindingValue != "" {
		query = query.Where("binding_value = ?", bindingValue)
	}
	bindingName = strings.TrimSpace(bindingName)
	if bindingName != "" {
		pattern := "%" + bindingName + "%"
		tokenIds := make([]int, 0)
		userIds := make([]int, 0)
		if err := DB.Model(&Token{}).Where("name LIKE ?", pattern).Pluck("id", &tokenIds).Error; err != nil {
			return nil, 0, err
		}
		if err := DB.Model(&User{}).Where("username LIKE ?", pattern).Pluck("id", &userIds).Error; err != nil {
			return nil, 0, err
		}
		tokenValues := make([]string, 0, len(tokenIds))
		for _, id := range tokenIds {
			tokenValues = append(tokenValues, strconv.Itoa(id))
		}
		userValues := make([]string, 0, len(userIds))
		for _, id := range userIds {
			userValues = append(userValues, strconv.Itoa(id))
		}
		switch {
		case len(tokenValues) > 0 && len(userValues) > 0:
			query = query.Where(
				"(binding_type = ? AND binding_value IN ?) OR (binding_type = ? AND binding_value IN ?)",
				PoolBindingTypeToken, tokenValues, PoolBindingTypeUser, userValues,
			)
		case len(tokenValues) > 0:
			query = query.Where("binding_type = ? AND binding_value IN ?", PoolBindingTypeToken, tokenValues)
		case len(userValues) > 0:
			query = query.Where("binding_type = ? AND binding_value IN ?", PoolBindingTypeUser, userValues)
		default:
			query = query.Where("1 = 0")
		}
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if limit > 0 {
		query = query.Limit(limit).Offset(offset)
	}
	if err := query.Order("priority DESC, id DESC").Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func CreatePoolBinding(item *PoolBinding) error {
	if item == nil {
		return errors.New("pool binding is nil")
	}
	duplicateCount := int64(0)
	if err := DB.Model(&PoolBinding{}).
		Where("binding_type = ? AND binding_value = ? AND pool_id = ?",
			item.BindingType, item.BindingValue, item.PoolId).
		Count(&duplicateCount).Error; err != nil {
		return err
	}
	if duplicateCount > 0 {
		return errors.New("duplicate pool binding: binding_type + binding_value + pool_id already exists")
	}
	return DB.Create(item).Error
}

func UpdatePoolBinding(item *PoolBinding) error {
	if item == nil || item.Id <= 0 {
		return errors.New("invalid pool binding")
	}
	duplicateCount := int64(0)
	if err := DB.Model(&PoolBinding{}).
		Where("binding_type = ? AND binding_value = ? AND pool_id = ? AND id <> ?",
			item.BindingType, item.BindingValue, item.PoolId, item.Id).
		Count(&duplicateCount).Error; err != nil {
		return err
	}
	if duplicateCount > 0 {
		return errors.New("duplicate pool binding: binding_type + binding_value + pool_id already exists")
	}
	return DB.Model(&PoolBinding{}).Where("id = ?", item.Id).Updates(map[string]interface{}{
		"binding_type":  item.BindingType,
		"binding_value": item.BindingValue,
		"pool_id":       item.PoolId,
		"priority":      item.Priority,
		"enabled":       item.Enabled,
		"updated_at":    common.GetTimestamp(),
	}).Error
}

func DeletePoolBinding(id int) error {
	if id <= 0 {
		return errors.New("invalid pool binding id")
	}
	return DB.Where("id = ?", id).Delete(&PoolBinding{}).Error
}

func GetPoolPolicies(poolId int, metric, scopeType string, offset, limit int) ([]*PoolQuotaPolicy, int64, error) {
	items := make([]*PoolQuotaPolicy, 0)
	total := int64(0)
	query := DB.Model(&PoolQuotaPolicy{})
	if poolId > 0 {
		query = query.Where("pool_id = ?", poolId)
	}
	if metric != "" {
		query = query.Where("metric = ?", metric)
	}
	if scopeType != "" {
		query = query.Where("scope_type = ?", scopeType)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if limit > 0 {
		query = query.Limit(limit).Offset(offset)
	}
	if err := query.Order("window_seconds ASC, id DESC").Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func CreatePoolPolicy(item *PoolQuotaPolicy) error {
	if item == nil {
		return errors.New("pool policy is nil")
	}
	return DB.Create(item).Error
}

func UpdatePoolPolicy(item *PoolQuotaPolicy) error {
	if item == nil || item.Id <= 0 {
		return errors.New("invalid pool policy")
	}
	return DB.Model(&PoolQuotaPolicy{}).Where("id = ?", item.Id).Updates(map[string]interface{}{
		"pool_id":        item.PoolId,
		"metric":         item.Metric,
		"scope_type":     item.ScopeType,
		"window_seconds": item.WindowSeconds,
		"limit_count":    item.LimitCount,
		"enabled":        item.Enabled,
		"updated_at":     common.GetTimestamp(),
	}).Error
}

func DeletePoolPolicy(id int) error {
	if id <= 0 {
		return errors.New("invalid pool policy id")
	}
	return DB.Where("id = ?", id).Delete(&PoolQuotaPolicy{}).Error
}
