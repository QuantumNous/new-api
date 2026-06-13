package model

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	ChannelFlowBackendMemory = "memory"
	ChannelFlowBackendRedis  = "redis"

	ChannelFlowQueuePolicyFIFO = "fifo"

	ChannelFlowOnLimitQueue    = "queue"
	ChannelFlowOnLimitReject   = "reject"
	ChannelFlowOnLimitFallback = "fallback"

	ChannelFlowRedisFailureFailOpen    = "fail_open"
	ChannelFlowRedisFailureFailClosed  = "fail_closed"
	ChannelFlowRedisFailureLocalMemory = "local_memory"

	ChannelFlowMatchModeChannel      = "channel"
	ChannelFlowMatchModeChannelModel = "channel_model"
)

type ChannelFlowPool struct {
	Id                 int    `json:"id"`
	PoolKey            string `json:"pool_key" gorm:"type:varchar(64);uniqueIndex"`
	Name               string `json:"name" gorm:"type:varchar(128);index"`
	Description        string `json:"description" gorm:"type:text"`
	Enabled            bool   `json:"enabled" gorm:"default:true"`
	Backend            string `json:"backend" gorm:"type:varchar(32);default:'memory'"`
	MaxInflight        int    `json:"max_inflight" gorm:"default:0"`
	MaxQueueSize       int    `json:"max_queue_size" gorm:"default:0"`
	MaxQueuePerUser    int    `json:"max_queue_per_user" gorm:"default:0"`
	QueueTimeoutMs     int64  `json:"queue_timeout_ms" gorm:"bigint;default:120000"`
	QueuePolicy        string `json:"queue_policy" gorm:"type:varchar(32);default:'fifo'"`
	OnLimit            string `json:"on_limit" gorm:"type:varchar(32);default:'queue'"`
	RedisFailurePolicy string `json:"redis_failure_policy" gorm:"type:varchar(32);default:'fail_open'"`
	MaxContextTokens   int    `json:"max_context_tokens" gorm:"default:0"`
	MaxContextChars    int    `json:"max_context_chars" gorm:"default:0"`
	MaxProcessingMs    int64  `json:"max_processing_ms" gorm:"bigint;default:0"`
	LeaseMs            int64  `json:"lease_ms" gorm:"bigint;default:60000"`
	RenewIntervalMs    int64  `json:"renew_interval_ms" gorm:"bigint;default:20000"`
	ConfigVersion      int64  `json:"config_version" gorm:"bigint;default:1"`
	CreatedTime        int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime        int64  `json:"updated_time" gorm:"bigint"`
}

type ChannelFlowPoolBinding struct {
	Id            int    `json:"id"`
	PoolId        int    `json:"pool_id" gorm:"index"`
	ChannelId     int    `json:"channel_id" gorm:"index"`
	UpstreamModel string `json:"upstream_model" gorm:"type:varchar(191);default:''"`
	MatchMode     string `json:"match_mode" gorm:"type:varchar(32);default:'channel'"`
	Enabled       bool   `json:"enabled" gorm:"default:true"`
	CreatedTime   int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime   int64  `json:"updated_time" gorm:"bigint"`
}

type ChannelFlowMetricMinute struct {
	Id                 int     `json:"id"`
	BucketTs           int64   `json:"bucket_ts" gorm:"bigint;index"`
	PoolKey            string  `json:"pool_key" gorm:"type:varchar(64);index"`
	ChannelId          int     `json:"channel_id" gorm:"index"`
	Model              string  `json:"model" gorm:"type:varchar(191);index"`
	RunningAvg         float64 `json:"running_avg"`
	RunningMax         int     `json:"running_max"`
	QueuedAvg          float64 `json:"queued_avg"`
	QueuedMax          int     `json:"queued_max"`
	AcquiredCount      int     `json:"acquired_count"`
	QueuedCount        int     `json:"queued_count"`
	ReleasedCount      int     `json:"released_count"`
	RejectedCount      int     `json:"rejected_count"`
	TimeoutCount       int     `json:"timeout_count"`
	CancelledCount     int     `json:"cancelled_count"`
	BillingFailedCount int     `json:"billing_failed_count"`
	LeaseRenewFail     int     `json:"lease_renew_fail"`
	LeaseExpiredCount  int     `json:"lease_expired_count"`
	WaitMsAvg          int64   `json:"wait_ms_avg" gorm:"bigint"`
	WaitMsMax          int64   `json:"wait_ms_max" gorm:"bigint"`
	ProcessMsAvg       int64   `json:"process_ms_avg" gorm:"bigint"`
	ProcessMsMax       int64   `json:"process_ms_max" gorm:"bigint"`
	CreatedTime        int64   `json:"created_time" gorm:"bigint"`
	UpdatedTime        int64   `json:"updated_time" gorm:"bigint"`
}

type ChannelFlowEvent struct {
	Id          int    `json:"id"`
	RequestId   string `json:"request_id" gorm:"type:varchar(64);index"`
	PoolKey     string `json:"pool_key" gorm:"type:varchar(64);index"`
	ChannelId   int    `json:"channel_id" gorm:"index"`
	Model       string `json:"model" gorm:"type:varchar(191);index"`
	UserId      int    `json:"user_id" gorm:"index"`
	TokenId     int    `json:"token_id" gorm:"index"`
	EventType   string `json:"event_type" gorm:"type:varchar(64);index"`
	Reason      string `json:"reason" gorm:"type:text"`
	Running     int    `json:"running"`
	Queued      int    `json:"queued"`
	QueuePos    int    `json:"queue_pos"`
	WaitMs      int64  `json:"wait_ms" gorm:"bigint"`
	ProcessMs   int64  `json:"process_ms" gorm:"bigint"`
	Backend     string `json:"backend" gorm:"type:varchar(32)"`
	CreatedTime int64  `json:"created_time" gorm:"bigint;index"`
}

func (p *ChannelFlowPool) Normalize() {
	p.Name = strings.TrimSpace(p.Name)
	p.Description = strings.TrimSpace(p.Description)
	if p.Backend == "" {
		p.Backend = ChannelFlowBackendMemory
	}
	if p.QueuePolicy == "" {
		p.QueuePolicy = ChannelFlowQueuePolicyFIFO
	}
	if p.OnLimit == "" {
		p.OnLimit = ChannelFlowOnLimitQueue
	}
	if p.RedisFailurePolicy == "" {
		p.RedisFailurePolicy = ChannelFlowRedisFailureFailOpen
	}
	if p.QueueTimeoutMs <= 0 {
		p.QueueTimeoutMs = 120000
	}
	if p.LeaseMs <= 0 {
		p.LeaseMs = 60000
	}
	if p.RenewIntervalMs <= 0 {
		p.RenewIntervalMs = 20000
	}
	if p.MaxQueueSize <= 0 && p.MaxInflight > 0 {
		p.MaxQueueSize = p.MaxInflight * 4
	}
}

func (p *ChannelFlowPool) Validate() error {
	p.Normalize()
	if p.Name == "" {
		return fmt.Errorf("flow pool name cannot be empty")
	}
	if p.MaxInflight < 0 || p.MaxQueueSize < 0 || p.MaxQueuePerUser < 0 {
		return fmt.Errorf("flow pool limits cannot be negative")
	}
	if p.MaxInflight == 0 && p.MaxContextTokens == 0 && p.MaxContextChars == 0 {
		return fmt.Errorf("max_inflight or context limit must be configured")
	}
	switch p.Backend {
	case ChannelFlowBackendMemory, ChannelFlowBackendRedis:
	default:
		return fmt.Errorf("invalid flow pool backend: %s", p.Backend)
	}
	switch p.QueuePolicy {
	case ChannelFlowQueuePolicyFIFO:
	default:
		return fmt.Errorf("invalid flow pool queue_policy: %s", p.QueuePolicy)
	}
	switch p.OnLimit {
	case ChannelFlowOnLimitQueue, ChannelFlowOnLimitReject, ChannelFlowOnLimitFallback:
	default:
		return fmt.Errorf("invalid flow pool on_limit: %s", p.OnLimit)
	}
	switch p.RedisFailurePolicy {
	case ChannelFlowRedisFailureFailOpen, ChannelFlowRedisFailureFailClosed, ChannelFlowRedisFailureLocalMemory:
	default:
		return fmt.Errorf("invalid flow pool redis_failure_policy: %s", p.RedisFailurePolicy)
	}
	return nil
}

func (p *ChannelFlowPool) BeforeCreate(_ *gorm.DB) error {
	now := time.Now().Unix()
	if p.CreatedTime == 0 {
		p.CreatedTime = now
	}
	if p.UpdatedTime == 0 {
		p.UpdatedTime = now
	}
	if p.ConfigVersion == 0 {
		p.ConfigVersion = 1
	}
	if p.PoolKey == "" {
		p.PoolKey = GenerateChannelFlowPoolKey()
	}
	return p.Validate()
}

func (p *ChannelFlowPool) BeforeUpdate(_ *gorm.DB) error {
	p.UpdatedTime = time.Now().Unix()
	p.ConfigVersion++
	return p.Validate()
}

func (b *ChannelFlowPoolBinding) Normalize() {
	b.UpstreamModel = strings.TrimSpace(b.UpstreamModel)
	if b.MatchMode == "" {
		b.MatchMode = ChannelFlowMatchModeChannel
	}
	if b.MatchMode == ChannelFlowMatchModeChannel {
		b.UpstreamModel = ""
	}
}

func (b *ChannelFlowPoolBinding) Validate() error {
	b.Normalize()
	if b.PoolId <= 0 {
		return fmt.Errorf("pool_id is required")
	}
	if b.ChannelId <= 0 {
		return fmt.Errorf("channel_id is required")
	}
	switch b.MatchMode {
	case ChannelFlowMatchModeChannel:
	case ChannelFlowMatchModeChannelModel:
		if b.UpstreamModel == "" {
			return fmt.Errorf("upstream_model is required for channel_model binding")
		}
	default:
		return fmt.Errorf("invalid flow pool binding match_mode: %s", b.MatchMode)
	}
	return nil
}

func (b *ChannelFlowPoolBinding) BeforeCreate(_ *gorm.DB) error {
	now := time.Now().Unix()
	if b.CreatedTime == 0 {
		b.CreatedTime = now
	}
	if b.UpdatedTime == 0 {
		b.UpdatedTime = now
	}
	return b.Validate()
}

func (b *ChannelFlowPoolBinding) BeforeUpdate(_ *gorm.DB) error {
	b.UpdatedTime = time.Now().Unix()
	return b.Validate()
}

func GenerateChannelFlowPoolKey() string {
	return "flow_pool_" + strings.ToLower(common.GetRandomString(12))
}

func GetChannelFlowPoolByID(id int) (*ChannelFlowPool, error) {
	var pool ChannelFlowPool
	if err := DB.First(&pool, id).Error; err != nil {
		return nil, err
	}
	return &pool, nil
}

func GetChannelFlowPoolByKey(poolKey string) (*ChannelFlowPool, error) {
	var pool ChannelFlowPool
	if err := DB.Where("pool_key = ?", poolKey).First(&pool).Error; err != nil {
		return nil, err
	}
	return &pool, nil
}

func GetChannelFlowPoolBindingForChannel(channelID int) (*ChannelFlowPoolBinding, *ChannelFlowPool, error) {
	var binding ChannelFlowPoolBinding
	if err := DB.Where("channel_id = ? AND match_mode = ? AND enabled = ?", channelID, ChannelFlowMatchModeChannel, true).
		Order("id ASC").
		First(&binding).Error; err != nil {
		return nil, nil, err
	}
	pool, err := GetChannelFlowPoolByID(binding.PoolId)
	if err != nil {
		return nil, nil, err
	}
	return &binding, pool, nil
}

func CountChannelFlowPoolBindings(poolID int) (int64, error) {
	var count int64
	err := DB.Model(&ChannelFlowPoolBinding{}).Where("pool_id = ?", poolID).Count(&count).Error
	return count, err
}
