package relay

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestApplyOtherRatiosToQuotaMultipliesBeforeTruncating(t *testing.T) {
	ratios := map[string]float64{
		"resolution":  51.0 / 46.0,
		"video_input": 31.0 / 51.0,
	}

	if got := applyOtherRatiosToQuota(46, ratios); got != 31 {
		t.Fatalf("quota: got %d want 31", got)
	}
}

func TestRecalcQuotaFromRatiosMultipliesBeforeTruncating(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 46,
		},
	}
	ratios := map[string]float64{
		"resolution":  51.0 / 46.0,
		"video_input": 31.0 / 51.0,
	}

	if got := recalcQuotaFromRatios(info, ratios); got != 31 {
		t.Fatalf("quota: got %d want 31", got)
	}
}

func TestGetTaskForVideoFetchFindsAssetByUpstreamAssetID(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Task{}))
	oldDB := model.DB
	oldUsingSQLite := common.UsingSQLite
	model.DB = db
	common.UsingSQLite = true
	t.Cleanup(func() {
		model.DB = oldDB
		common.UsingSQLite = oldUsingSQLite
	})

	createdAt := time.Now().Unix()
	require.NoError(t, db.Create(&model.Task{
		TaskID:    "task_public_asset",
		UserId:    7,
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "asset-20260319082447-qrrjp",
			UpstreamKind:   "asset",
		},
	}).Error)

	task, exist, err := getTaskForVideoFetch(7, "asset-20260319082447-qrrjp", "/v1/assets/asset-20260319082447-qrrjp")
	require.NoError(t, err)
	require.True(t, exist)
	require.NotNil(t, task)
	require.Equal(t, "task_public_asset", task.TaskID)
}
