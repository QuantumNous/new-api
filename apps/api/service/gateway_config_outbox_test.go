package service

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGatewayConfigOutboxPublishMarksAfterRedisSuccess(t *testing.T) {
	previousDB, previousRedis, previousRDB := model.DB, common.RedisEnabled, common.RDB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.GatewayConfigOutbox{}))
	model.DB = db
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	common.RedisEnabled, common.RDB = true, client
	t.Cleanup(func() {
		_ = client.Close()
		model.DB, common.RedisEnabled, common.RDB = previousDB, previousRedis, previousRDB
	})

	subscriber := client.Subscribe(context.Background(), GatewayRoutingRevisionChannel)
	require.NoError(t, subscriber.Close())
	require.NoError(t, db.Create(&model.GatewayConfigOutbox{RoutingRevision: 11}).Error)
	require.NoError(t, PublishPendingGatewayRevisions(context.Background(), 10))

	var row model.GatewayConfigOutbox
	require.NoError(t, db.First(&row).Error)
	require.NotNil(t, row.PublishedAt)
	require.Equal(t, 1, row.PublishAttempts)
	require.Equal(t, "published", row.LastPublishErrorClass)
}

func TestGatewayConfigOutboxPublishFailureKeepsRowPending(t *testing.T) {
	previousDB, previousRedis, previousRDB := model.DB, common.RedisEnabled, common.RDB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.GatewayConfigOutbox{}))
	model.DB = db
	common.RedisEnabled, common.RDB = false, nil
	t.Cleanup(func() { model.DB, common.RedisEnabled, common.RDB = previousDB, previousRedis, previousRDB })

	require.NoError(t, db.Create(&model.GatewayConfigOutbox{RoutingRevision: 12}).Error)
	require.NoError(t, PublishPendingGatewayRevisions(context.Background(), 10))

	var row model.GatewayConfigOutbox
	require.NoError(t, db.First(&row).Error)
	require.Nil(t, row.PublishedAt)
	require.Equal(t, 1, row.PublishAttempts)
	require.Equal(t, "redis_disabled", row.LastPublishErrorClass)
}

func TestGatewayConfigOutboxPublishedMarkerIsIdempotent(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.GatewayConfigOutbox{}))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	first := time.Date(2026, 8, 16, 1, 0, 0, 0, time.UTC)
	second := first.Add(time.Minute)
	require.NoError(t, db.Create(&model.GatewayConfigOutbox{RoutingRevision: 13}).Error)
	require.NoError(t, model.MarkGatewayConfigOutboxPublished(1, first))
	require.NoError(t, model.MarkGatewayConfigOutboxPublished(1, second))

	var row model.GatewayConfigOutbox
	require.NoError(t, db.First(&row).Error)
	require.Equal(t, first, row.PublishedAt.UTC())
}
