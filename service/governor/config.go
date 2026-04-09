package governor

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type Config struct {
	Enabled                     bool
	ChannelMaxRPM               int64
	ChannelCooldownSeconds      int
	ChannelCooldownOnStatuses   []int
	KeyMaxConcurrency           int64
	KeyCooldownSeconds          int
	KeyCooldownOnStatuses       []int
	ReservationLeaseSeconds     int
	ReservationHeartbeatSeconds int
	ShortWaitMS                 int
	RespectRetryAfter           bool
}

func FromChannel(channel *model.Channel) Config {
	cfg := Config{}
	if channel != nil {
		if governorSettings := channel.GetSetting().Governor; governorSettings != nil {
			cfg.Enabled = governorSettings.Enabled
			cfg.ChannelMaxRPM = int64(governorSettings.ChannelMaxRPM)
			cfg.ChannelCooldownSeconds = governorSettings.ChannelCooldownSeconds
			cfg.ChannelCooldownOnStatuses = append([]int(nil), governorSettings.ChannelCooldownOnStatuses...)
			cfg.KeyMaxConcurrency = int64(governorSettings.KeyMaxConcurrency)
			cfg.KeyCooldownSeconds = governorSettings.KeyCooldownSeconds
			cfg.KeyCooldownOnStatuses = append([]int(nil), governorSettings.KeyCooldownOnStatuses...)
			cfg.ReservationLeaseSeconds = governorSettings.ReservationLeaseSeconds
			cfg.ReservationHeartbeatSeconds = governorSettings.ReservationHeartbeatSeconds
			cfg.ShortWaitMS = governorSettings.ShortWaitMs
			cfg.RespectRetryAfter = governorSettings.RespectRetryAfter
		}
	}
	if cfg.ReservationLeaseSeconds <= 0 {
		cfg.ReservationLeaseSeconds = 90
	}
	if cfg.ReservationHeartbeatSeconds <= 0 {
		cfg.ReservationHeartbeatSeconds = 20
	}
	if cfg.ShortWaitMS < 0 {
		cfg.ShortWaitMS = 0
	}
	return cfg
}

type Store interface {
	IsChannelCooling(ctx context.Context, channelID int) (bool, time.Duration, error)
	IsKeyCooling(ctx context.Context, channelID int, keyIndex int) (bool, time.Duration, error)
	AllowChannelRPM(ctx context.Context, channelID int, limit int64) (bool, error)
	AcquireKeyLease(ctx context.Context, channelID int, keyIndex int, reservationID string, limit int64, leaseTTL time.Duration) (bool, error)
	TouchKeyLease(ctx context.Context, channelID int, keyIndex int, reservationID string, leaseTTL time.Duration) error
	ReleaseKeyLease(ctx context.Context, channelID int, keyIndex int, reservationID string) error
	CoolChannel(ctx context.Context, channelID int, ttl time.Duration) error
	CoolKey(ctx context.Context, channelID int, keyIndex int, ttl time.Duration) error
}

var storeFactory = func() Store {
	if !common.RedisEnabled || common.RDB == nil {
		return nil
	}
	return NewRedisStore(common.RDB)
}

func SetStoreFactoryForTest(factory func() Store) func() {
	previous := storeFactory
	storeFactory = factory
	return func() {
		storeFactory = previous
	}
}
