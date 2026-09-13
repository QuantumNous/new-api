package model

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestChannelValidateSettingsRejectsInvalidHTTPTransport(t *testing.T) {
	tests := []struct {
		name    string
		setting dto.ChannelSettings
		wantErr string
	}{
		{
			name:    "auto with shards is valid",
			setting: dto.ChannelSettings{HTTPProtocol: "auto", HTTP2ConnectionShards: 4},
		},
		{
			name:    "http1 with shards greater than one rejected",
			setting: dto.ChannelSettings{HTTPProtocol: "http1", HTTP2ConnectionShards: 2},
			wantErr: "http2_connection_shards",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := &Channel{}
			channel.SetSetting(tt.setting)
			err := channel.ValidateSettings()
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestAdvancedCustomChannelRequiresModelListRouteOnlyWhenUpdateChecksEnabled(t *testing.T) {
	inferenceRoute := dto.AdvancedCustomRoute{
		IncomingPath: "/v1/chat/completions",
		UpstreamPath: "/v1/chat/completions",
		Converter:    "none",
	}

	tests := []struct {
		name          string
		checksEnabled bool
		routes        []dto.AdvancedCustomRoute
		wantErr       string
	}{
		{
			name:   "legacy channel without discovery route remains valid",
			routes: []dto.AdvancedCustomRoute{inferenceRoute},
		},
		{
			name:          "enabled checks require discovery route",
			checksEnabled: true,
			routes:        []dto.AdvancedCustomRoute{inferenceRoute},
			wantErr:       dto.AdvancedCustomModelListPath,
		},
		{
			name:          "enabled checks accept discovery route",
			checksEnabled: true,
			routes: []dto.AdvancedCustomRoute{
				inferenceRoute,
				{
					IncomingPath: dto.AdvancedCustomModelListPath,
					UpstreamPath: dto.AdvancedCustomModelListPath,
					Converter:    "none",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := &Channel{Type: constant.ChannelTypeAdvancedCustom}
			channel.SetOtherSettings(dto.ChannelOtherSettings{
				UpstreamModelUpdateCheckEnabled: tt.checksEnabled,
				AdvancedCustom: &dto.AdvancedCustomConfig{
					Routes: tt.routes,
				},
			})

			err := channel.ValidateSettings()
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestChannelValidateSettingsChecksVideoSupplierCost(t *testing.T) {
	tests := []struct {
		name    string
		cost    *dto.VideoSupplierCost
		wantErr string
	}{
		{
			name: "fixed cost",
			cost: &dto.VideoSupplierCost{Currency: "CNY", PerRequest: "6"},
		},
		{
			name: "per-second cost",
			cost: &dto.VideoSupplierCost{Currency: "CNY", PerSecond: "1.25"},
		},
		{
			name: "combined cost",
			cost: &dto.VideoSupplierCost{Currency: "USD", PerRequest: "0.1", PerSecond: "0.02"},
		},
		{
			name:    "missing amount",
			cost:    &dto.VideoSupplierCost{Currency: "CNY"},
			wantErr: "requires per_request or per_second",
		},
		{
			name:    "negative amount",
			cost:    &dto.VideoSupplierCost{Currency: "CNY", PerSecond: "-1"},
			wantErr: "non-negative decimal",
		},
		{
			name:    "invalid currency",
			cost:    &dto.VideoSupplierCost{Currency: "¥", PerRequest: "6"},
			wantErr: "currency",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			channel := &Channel{}
			channel.SetOtherSettings(dto.ChannelOtherSettings{VideoSupplierCost: test.cost})
			err := channel.ValidateSettings()
			if test.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.wantErr)
		})
	}
}

func TestLowestVideoCostChannelIDs(t *testing.T) {
	priority := int64(0)
	weight := uint(100)
	channelWithCost := func(id int, currency, perRequest, perSecond string) *Channel {
		channel := &Channel{Id: id, Priority: &priority, Weight: &weight}
		channel.SetOtherSettings(dto.ChannelOtherSettings{VideoSupplierCost: &dto.VideoSupplierCost{
			Currency: currency, PerRequest: perRequest, PerSecond: perSecond,
		}})
		return channel
	}
	perSecond := channelWithCost(1, "CNY", "", "1")
	fixed := channelWithCost(2, "CNY", "6", "")

	tests := []struct {
		name        string
		duration    int
		channels    []*Channel
		wantIDs     map[int]struct{}
		wantApplied bool
	}{
		{
			name: "five seconds selects per-second channel", duration: 5,
			channels: []*Channel{perSecond, fixed}, wantIDs: map[int]struct{}{1: {}}, wantApplied: true,
		},
		{
			name: "seven seconds selects fixed channel", duration: 7,
			channels: []*Channel{perSecond, fixed}, wantIDs: map[int]struct{}{2: {}}, wantApplied: true,
		},
		{
			name: "equal estimates keep both for weight selection", duration: 6,
			channels: []*Channel{perSecond, fixed}, wantIDs: map[int]struct{}{1: {}, 2: {}}, wantApplied: true,
		},
		{
			name: "missing policy falls back", duration: 5,
			channels: []*Channel{perSecond, {Id: 3}},
		},
		{
			name: "mixed currencies fall back", duration: 5,
			channels: []*Channel{perSecond, channelWithCost(4, "USD", "1", "")},
		},
		{
			name: "missing duration falls back", channels: []*Channel{perSecond, fixed},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, applied := lowestVideoCostChannelIDs(test.channels, test.duration)
			assert.Equal(t, test.wantApplied, applied)
			assert.Equal(t, test.wantIDs, got)
		})
	}
}

func TestGetChannelWithOptionsUsesVideoCostWithoutMemoryCache(t *testing.T) {
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	database, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	testGetChannelWithOptionsUsesVideoCost(t, database, "`group`")
}

func TestGetChannelWithOptionsUsesVideoCostWithMySQL(t *testing.T) {
	dsn := os.Getenv("NEWAPI_TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("NEWAPI_TEST_MYSQL_DSN is not configured")
	}
	database, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	testGetChannelWithOptionsUsesVideoCost(t, database, "`group`")
}

func TestGetChannelWithOptionsUsesVideoCostWithPostgreSQL(t *testing.T) {
	dsn := os.Getenv("NEWAPI_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("NEWAPI_TEST_POSTGRES_DSN is not configured")
	}
	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	testGetChannelWithOptionsUsesVideoCost(t, database, `"group"`)
}

func testGetChannelWithOptionsUsesVideoCost(t *testing.T, database *gorm.DB, groupColumn string) {
	originalDB := DB
	originalGroupColumn := commonGroupCol
	require.NoError(t, database.AutoMigrate(&Channel{}, &Ability{}))
	DB = database
	commonGroupCol = groupColumn
	testChannelIDs := []int{920001, 920002}
	require.NoError(t, database.Where("channel_id IN ?", testChannelIDs).Delete(&Ability{}).Error)
	require.NoError(t, database.Where("id IN ?", testChannelIDs).Delete(&Channel{}).Error)
	t.Cleanup(func() {
		database.Where("channel_id IN ?", testChannelIDs).Delete(&Ability{})
		database.Where("id IN ?", testChannelIDs).Delete(&Channel{})
		DB = originalDB
		commonGroupCol = originalGroupColumn
		sqlDB, dbErr := database.DB()
		if dbErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	priority := int64(10)
	weight := uint(100)
	channels := []*Channel{
		{Id: testChannelIDs[0], Type: constant.ChannelTypeOpenAI, Key: "test-key-per-second", Status: common.ChannelStatusEnabled, Name: "per-second", Models: "video-model", Group: "default", Priority: &priority, Weight: &weight},
		{Id: testChannelIDs[1], Type: constant.ChannelTypeOpenAI, Key: "test-key-fixed", Status: common.ChannelStatusEnabled, Name: "fixed", Models: "video-model", Group: "default", Priority: &priority, Weight: &weight},
	}
	channels[0].SetOtherSettings(dto.ChannelOtherSettings{VideoSupplierCost: &dto.VideoSupplierCost{Currency: "CNY", PerSecond: "1"}})
	channels[1].SetOtherSettings(dto.ChannelOtherSettings{VideoSupplierCost: &dto.VideoSupplierCost{Currency: "CNY", PerRequest: "6"}})
	for _, channel := range channels {
		require.NoError(t, database.Create(channel).Error)
		require.NoError(t, database.Create(&Ability{
			Group: "default", Model: "video-model", ChannelId: channel.Id,
			Enabled: true, Priority: channel.Priority, Weight: uint(channel.GetWeight()),
		}).Error)
	}

	channel, err := GetChannelWithOptions("default", "video-model", 0, ChannelSelectionOptions{VideoDurationSeconds: 7})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, testChannelIDs[1], channel.Id)
}
