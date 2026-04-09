package governor

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestRedisStoreAcquireReleaseLease(t *testing.T) {
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := NewRedisStore(client)

	ok, err := store.AcquireKeyLease(context.Background(), 11, 2, "lease-a", 1, 30*time.Second)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = store.AcquireKeyLease(context.Background(), 11, 2, "lease-b", 1, 30*time.Second)
	require.NoError(t, err)
	require.False(t, ok)

	require.NoError(t, store.ReleaseKeyLease(context.Background(), 11, 2, "lease-a"))

	ok, err = store.AcquireKeyLease(context.Background(), 11, 2, "lease-b", 1, 30*time.Second)
	require.NoError(t, err)
	require.True(t, ok)
}

func TestRedisStoreTouchLeaseExtendsLease(t *testing.T) {
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := NewRedisStore(client)

	ok, err := store.AcquireKeyLease(context.Background(), 11, 2, "lease-a", 1, 10*time.Second)
	require.NoError(t, err)
	require.True(t, ok)

	mr.FastForward(8 * time.Second)
	require.NoError(t, store.TouchKeyLease(context.Background(), 11, 2, "lease-a", 10*time.Second))
	mr.FastForward(5 * time.Second)

	ok, err = store.AcquireKeyLease(context.Background(), 11, 2, "lease-b", 1, 10*time.Second)
	require.NoError(t, err)
	require.False(t, ok)
}
