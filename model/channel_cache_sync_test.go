package model

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestInitChannelCachePreservesLastKnownGoodCacheOnQueryFailure(t *testing.T) {
	for _, failedTable := range []string{"channels", "abilities"} {
		t.Run(failedTable, func(t *testing.T) {
			oldDB := DB
			oldMemoryCacheEnabled := common.MemoryCacheEnabled
			channelSyncLock.RLock()
			oldChannels := channelsIDM
			oldGroups := group2model2channels
			oldAdvancedCustom := channel2advancedCustomConfig
			channelSyncLock.RUnlock()

			dsn := fmt.Sprintf("file:channel-cache-sync-%s-%d?mode=memory&cache=shared", failedTable, time.Now().UnixNano())
			db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
			require.NoError(t, err)
			require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
			require.NoError(t, db.Create(&Channel{
				Id:     29,
				Status: common.ChannelStatusEnabled,
				Group:  "default",
				Models: "gpt-5.6-sol",
			}).Error)

			DB = db
			common.MemoryCacheEnabled = true
			priority := int64(10)
			weight := uint(100)
			cached := &Channel{Id: 17, Status: common.ChannelStatusEnabled, Priority: &priority, Weight: &weight}
			SetChannelCacheForTest(map[int]*Channel{17: cached}, map[string]map[string][]int{
				"default": {"gpt-5.6-sol": {17}},
			})

			require.NoError(t, db.Callback().Query().Before("gorm:query").Register("force_channel_cache_query_error", func(tx *gorm.DB) {
				if tx.Statement.Table == failedTable {
					tx.AddError(errors.New("forced channel cache query failure"))
				}
			}))

			t.Cleanup(func() {
				DB = oldDB
				common.MemoryCacheEnabled = oldMemoryCacheEnabled
				channelSyncLock.Lock()
				channelsIDM = oldChannels
				group2model2channels = oldGroups
				channel2advancedCustomConfig = oldAdvancedCustom
				channelSyncLock.Unlock()
			})

			assert.NotPanics(t, InitChannelCache)
			got, err := CacheGetChannel(17)
			require.NoError(t, err)
			assert.Same(t, cached, got)
			_, err = CacheGetChannel(29)
			assert.Error(t, err, "a partial database snapshot must not replace the last-known-good cache")
		})
	}
}
