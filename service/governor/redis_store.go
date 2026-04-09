package governor

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

//go:embed lua/acquire_lease.lua
var acquireLeaseScript string

//go:embed lua/release_lease.lua
var releaseLeaseScript string

//go:embed lua/touch_lease.lua
var touchLeaseScript string

//go:embed lua/incr_rpm.lua
var incrRPMScript string

type RedisStore struct {
	client        *redis.Client
	acquireScript *redis.Script
	releaseScript *redis.Script
	touchScript   *redis.Script
	rpmScript     *redis.Script
}

func NewRedisStore(client *redis.Client) *RedisStore {
	return &RedisStore{
		client:        client,
		acquireScript: redis.NewScript(acquireLeaseScript),
		releaseScript: redis.NewScript(releaseLeaseScript),
		touchScript:   redis.NewScript(touchLeaseScript),
		rpmScript:     redis.NewScript(incrRPMScript),
	}
}

func (s *RedisStore) IsChannelCooling(ctx context.Context, channelID int) (bool, time.Duration, error) {
	return ttlActive(ctx, s.client, channelCooldownKey(channelID))
}

func (s *RedisStore) IsKeyCooling(ctx context.Context, channelID int, keyIndex int) (bool, time.Duration, error) {
	return ttlActive(ctx, s.client, keyCooldownKey(channelID, keyIndex))
}

func (s *RedisStore) AllowChannelRPM(ctx context.Context, channelID int, limit int64) (bool, error) {
	key := fmt.Sprintf("gov:channel:rpm:%d:%s", channelID, time.Now().UTC().Format("200601021504"))
	result, err := s.rpmScript.Run(ctx, s.client, []string{key}, limit, 70).Int()
	return result == 1, err
}

func (s *RedisStore) AcquireKeyLease(ctx context.Context, channelID int, keyIndex int, reservationID string, limit int64, leaseTTL time.Duration) (bool, error) {
	key := leaseKey(channelID, keyIndex)
	nowMS := time.Now().UnixMilli()
	leaseUntilMS := time.Now().Add(leaseTTL).UnixMilli()
	result, err := s.acquireScript.Run(ctx, s.client, []string{key}, nowMS, leaseUntilMS, limit, reservationID).Int()
	return result == 1, err
}

func (s *RedisStore) TouchKeyLease(ctx context.Context, channelID int, keyIndex int, reservationID string, leaseTTL time.Duration) error {
	key := leaseKey(channelID, keyIndex)
	nowMS := time.Now().UnixMilli()
	leaseUntilMS := time.Now().Add(leaseTTL).UnixMilli()
	result, err := s.touchScript.Run(ctx, s.client, []string{key}, nowMS, leaseUntilMS, reservationID).Int()
	if err != nil {
		return err
	}
	if result != 1 {
		return errors.New("lease not found")
	}
	return nil
}

func (s *RedisStore) ReleaseKeyLease(ctx context.Context, channelID int, keyIndex int, reservationID string) error {
	return s.releaseScript.Run(ctx, s.client, []string{leaseKey(channelID, keyIndex)}, reservationID).Err()
}

func (s *RedisStore) CoolChannel(ctx context.Context, channelID int, ttl time.Duration) error {
	return s.client.Set(ctx, channelCooldownKey(channelID), "1", ttl).Err()
}

func (s *RedisStore) CoolKey(ctx context.Context, channelID int, keyIndex int, ttl time.Duration) error {
	return s.client.Set(ctx, keyCooldownKey(channelID, keyIndex), "1", ttl).Err()
}

func ttlActive(ctx context.Context, client *redis.Client, key string) (bool, time.Duration, error) {
	ttl, err := client.PTTL(ctx, key).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return false, 0, err
	}
	return ttl > 0, ttl, nil
}

func channelCooldownKey(channelID int) string {
	return fmt.Sprintf("gov:channel:cooldown:%d", channelID)
}

func keyCooldownKey(channelID int, keyIndex int) string {
	return fmt.Sprintf("gov:key:cooldown:%d:%d", channelID, keyIndex)
}

func leaseKey(channelID int, keyIndex int) string {
	return fmt.Sprintf("gov:key:lease:%d:%d", channelID, keyIndex)
}
