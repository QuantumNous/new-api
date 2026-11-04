package handler

import (
	"encoding/json"
	"fmt"
	channelpkg "github.com/QuantumNous/new-api/internal/catalog"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/internal/transport/testutil"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func withChannelModelHealthControllerDB(t *testing.T) {
	t.Helper()
	previousDB := dbx.DB
	previousType := common.MainDatabaseType()
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)

	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	require.NoError(t, err)
	// RecoverUnit restores the model into the routable set, so the routing
	// tables and the gateway revision machinery must exist too.
	require.NoError(t, db.AutoMigrate(
		&channelpkg.ChannelModelHealth{},
		&channelpkg.Channel{}, &channelpkg.Ability{}, &channelpkg.ChannelModelRoute{},
		&channelpkg.GatewayConfigRevision{}, &channelpkg.GatewayConfigOutbox{},
	))
	dbx.DB = db
	require.NoError(t, channelpkg.InitializeGatewayConfigRevision())
	channelpkg.ClearUnitHealthCache()
	t.Cleanup(func() {
		channelpkg.ClearUnitHealthCache()
		common.SetMainDatabaseType(previousType)
		dbx.DB = previousDB
	})
}

func TestChannelModelHealthAdminAPI(t *testing.T) {
	withChannelModelHealthControllerDB(t)

	nowMs := time.Now().UnixMilli()
	// A live cooling row: not fresh, so it survives the listing filter.
	require.NoError(t, dbx.DB.Create(&channelpkg.ChannelModelHealth{
		ChannelId:          71,
		Model:              "gpt-health",
		Version:            1,
		EwmaScore:          0.5,
		RequestCount:       3,
		CooldownUntilMs:    nowMs + 30_000,
		LastCoolingOutcome: 1, // UnitFatal
		UpdatedAt:          nowMs,
	}).Error)

	t.Run("lists one channel's unit matrix", func(t *testing.T) {
		ctx, recorder := fiberadapter.NewSyntheticContext(
			httptest.NewRequest(http.MethodGet, "/api/channel/health?channel_id=71", nil))

		GetChannelModelHealth(ctx)

		require.Equal(t, http.StatusOK, recorder.Code)
		var response struct {
			Success bool                        `json:"success"`
			Data    []channelpkg.UnitHealthView `json:"data"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
		require.True(t, response.Success)
		require.Len(t, response.Data, 1)
		assert.Equal(t, "gpt-health", response.Data[0].Model)
		assert.Equal(t, "cooling", response.Data[0].State)
		assert.Equal(t, "fatal", response.Data[0].LastCoolingOutcome)
		assert.Greater(t, response.Data[0].RemainingCooldownMs, int64(0))
	})

	t.Run("disable then recover changes the persisted unit", func(t *testing.T) {
		post := func(action string) *httptest.ResponseRecorder {
			request := httptest.NewRequest(http.MethodPost, "/api/channel/health/"+action,
				strings.NewReader(`{"channel_id":71,"model":"gpt-health"}`))
			request.Header.Set("Content-Type", "application/json")
			return recordResponse(t, testutil.ServeBufferedRoute(t, http.MethodPost,
				"/api/channel/health/:action", nil, UpdateChannelModelHealth, request))
		}

		require.Equal(t, http.StatusOK, post("disable").Code)
		var row channelpkg.ChannelModelHealth
		require.NoError(t, dbx.DB.Where("channel_id = ? AND model = ?", 71, "gpt-health").First(&row).Error)
		assert.True(t, row.HardDisabled, "disable persists the hard-disable flag")

		require.Equal(t, http.StatusOK, post("recover").Code)
		require.NoError(t, dbx.DB.Where("channel_id = ? AND model = ?", 71, "gpt-health").First(&row).Error)
		assert.False(t, row.HardDisabled, "recover clears the hard-disable flag")
		assert.True(t, row.RampPending, "recover re-arms the slow-start ramp")
		assert.Zero(t, row.CooldownUntilMs, "recover drops any live cooldown")
	})

	t.Run("rejects unknown action", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodPost, "/api/channel/health/unknown",
			strings.NewReader(`{"channel_id":71,"model":"gpt-health"}`))
		request.Header.Set("Content-Type", "application/json")

		recorder := recordResponse(t, testutil.ServeBufferedRoute(t, http.MethodPost,
			"/api/channel/health/:action", nil, UpdateChannelModelHealth, request))

		var response struct {
			Success bool `json:"success"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
		assert.False(t, response.Success)
	})
}
