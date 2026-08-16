package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGatewayRoutingOptionAllowlistIsExplicit(t *testing.T) {
	expected := []string{
		"AudioCompletionRatio", "AudioRatio", "AutoGroups", "CacheRatio", "CompletionRatio",
		"CreateCacheRatio", "GroupGroupRatio", "GroupRatio", "ImageRatio", "MaxTokenAutoGroups",
		"ModelPrice", "ModelRatio", "UserUsableGroups",
	}
	assert.Equal(t, expected, GatewayRoutingOptionKeyList())
	assert.True(t, IsGatewayRoutingOptionKey("ModelRatio"))
	assert.False(t, IsGatewayRoutingOptionKey("ModelRatioSecret"))
	assert.False(t, IsGatewayRoutingOptionKey("proxy_config"))
}

func TestGatewayRoutingOptionUpdateCommitsOneRevision(t *testing.T) {
	previousDB := DB
	previousOptionMap := common.OptionMap
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}, &GatewayConfigRevision{}, &GatewayConfigOutbox{}))
	DB = db
	common.OptionMap = make(map[string]string)
	t.Cleanup(func() { DB, common.OptionMap = previousDB, previousOptionMap })
	require.NoError(t, InitializeGatewayConfigRevision())

	require.NoError(t, UpdateOption("ModelPrice", "{}"))
	assert.Equal(t, int64(2), currentGatewayRevision(t))
	assert.Equal(t, []int64{2}, outboxRevisions(t))
	assert.Equal(t, "{}", requireOptionValue(t, db, "ModelPrice"))
	assert.Equal(t, "{}", common.OptionMap["ModelPrice"])
}

func TestGatewayRoutingOptionBulkCommitsOneRevision(t *testing.T) {
	previousDB := DB
	previousOptionMap := common.OptionMap
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}, &GatewayConfigRevision{}, &GatewayConfigOutbox{}))
	DB = db
	common.OptionMap = make(map[string]string)
	t.Cleanup(func() { DB, common.OptionMap = previousDB, previousOptionMap })
	require.NoError(t, InitializeGatewayConfigRevision())

	require.NoError(t, UpdateOptionsBulk(map[string]string{"ModelRatio": "{}", "SMTPToken": "synthetic"}))
	assert.Equal(t, int64(2), currentGatewayRevision(t))
	assert.Equal(t, []int64{2}, outboxRevisions(t))
	assert.Equal(t, "synthetic", common.OptionMap["SMTPToken"])
}
