package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// A per-request price must be charged when the usage carries audio tokens.
func TestPostAudioConsumeQuota_FixedPriceIsCharged(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldMainType, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() { model.DB, model.LOG_DB = oldDB, oldLogDB; common.SetDatabaseTypes(oldMainType, oldLogType) })
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Channel{}, &model.Log{}))

	user := model.User{Username: "audio_fixed_price", Quota: 2_000_000, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	token := model.Token{UserId: user.Id, Key: "audio-fixed-price-test", Name: "audio", RemainQuota: 2_000_000, Status: common.TokenStatusEnabled}
	require.NoError(t, db.Create(&token).Error)
	channel := model.Channel{Name: "audio", Key: "unused", Status: common.ChannelStatusEnabled}
	require.NoError(t, db.Create(&channel).Error)

	info := &relaycommon.RelayInfo{
		UserId: user.Id, TokenId: token.Id, TokenKey: token.Key,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: channel.Id},
		OriginModelName: "tts-1", UsingGroup: "default", UserGroup: "default",
		StartTime: time.Now(),
		PriceData: hosttypes.PriceData{
			UsePrice:       true,
			ModelPrice:     0.02,
			GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
	}
	usage := &dto.Usage{
		CompletionTokens:       17,
		TotalTokens:            17,
		CompletionTokenDetails: dto.OutputTokenDetails{AudioTokens: 17},
	}
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/audio/speech", nil)

	PostAudioConsumeQuota(ctx, info, usage, nil)

	var log model.Log
	require.NoError(t, db.Where("user_id = ?", user.Id).Take(&log).Error)
	want := int(0.02 * common.QuotaPerUnit)
	assert.Equal(t, want, log.Quota)
}
