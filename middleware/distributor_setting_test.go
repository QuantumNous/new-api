package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDistributorSettingTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousSQLite := common.UsingSQLite
	previousMySQL := common.UsingMySQL
	previousPostgreSQL := common.UsingPostgreSQL

	dsn := fmt.Sprintf("file:distributor-setting-%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.UsingSQLite = previousSQLite
		common.UsingMySQL = previousMySQL
		common.UsingPostgreSQL = previousPostgreSQL
		if sqlDB, dbErr := db.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func readDistributorSettingBytes(t *testing.T, db *gorm.DB, channelID int) []byte {
	t.Helper()

	var setting []byte
	row := db.Raw("SELECT setting FROM channels WHERE id = ?", channelID).Row()
	require.NoError(t, row.Scan(&setting))
	return append([]byte(nil), setting...)
}

func newDistributorSettingTestContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	return c
}

func createDistributorSettingTestChannel(t *testing.T, db *gorm.DB, id int, rawSetting string) *model.Channel {
	t.Helper()

	channel := &model.Channel{
		Id:            id,
		Type:          1,
		Key:           "test-key",
		Status:        common.ChannelStatusEnabled,
		Name:          fmt.Sprintf("setting-test-%d", id),
		Models:        "gpt-image-2",
		Group:         "default",
		Setting:       &rawSetting,
		OtherSettings: "{}",
	}
	require.NoError(t, db.Create(channel).Error)
	return channel
}

func TestSetupContextForSelectedChannelMalformedSettingPreservesDatabaseBytes(t *testing.T) {
	db := setupDistributorSettingTestDB(t)
	const malformedSetting = "{not-json"
	channel := createDistributorSettingTestChannel(t, db, 9001, malformedSetting)

	var loaded model.Channel
	require.NoError(t, db.First(&loaded, channel.Id).Error)
	before := readDistributorSettingBytes(t, db, channel.Id)

	c := newDistributorSettingTestContext()
	setupErr := SetupContextForSelectedChannel(c, &loaded, "gpt-image-2")
	require.Nil(t, setupErr)

	after := readDistributorSettingBytes(t, db, channel.Id)
	require.Equal(t, before, after, "request-time setting parsing must not rewrite the database row")
	require.Equal(t, []byte(malformedSetting), after)
	require.NotNil(t, loaded.Setting)
	require.Equal(t, malformedSetting, *loaded.Setting, "request-time parsing must not clear the in-memory setting")

	setting, ok := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	require.True(t, ok)
	require.Equal(t, dto.ChannelSettings{}, setting, "malformed settings must safely degrade to an empty request setting")
}

func TestSetupContextForSelectedChannelNormalSettingPreservesSemantics(t *testing.T) {
	db := setupDistributorSettingTestDB(t)
	want := dto.ChannelSettings{
		Proxy:                  "https://proxy.invalid",
		PassThroughBodyEnabled: true,
		Image2Capability: &dto.Image2ChannelCapability{
			Enabled:       true,
			Operations:    []string{"generations", "edits"},
			Resolutions:   []string{"1024", "2048"},
			Qualities:     []string{"standard", "high"},
			MaxN:          2,
			RoutePriority: 7,
			EditsAccepted: true,
		},
	}
	encoded, err := common.Marshal(want)
	require.NoError(t, err)
	channel := createDistributorSettingTestChannel(t, db, 9002, string(encoded))

	var loaded model.Channel
	require.NoError(t, db.First(&loaded, channel.Id).Error)
	before := readDistributorSettingBytes(t, db, channel.Id)

	c := newDistributorSettingTestContext()
	setupErr := SetupContextForSelectedChannel(c, &loaded, "gpt-image-2")
	require.Nil(t, setupErr)

	after := readDistributorSettingBytes(t, db, channel.Id)
	require.Equal(t, before, after, "normal request-time parsing must remain read-only")
	setting, ok := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	require.True(t, ok)
	require.Equal(t, want, setting, "normal channel setting semantics must be preserved")
}
