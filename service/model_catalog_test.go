package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestAuditModelCatalogReadinessExplainsEveryVisibilityGate(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&[]model.Channel{
		{Id: 1, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "ready", Models: "ready,new-without-metadata,unpriced,ability-off", Group: "plg", Priority: &priority, Weight: &weight},
		{Id: 2, Type: constant.ChannelTypeAnthropic, Status: common.ChannelStatusAutoDisabled, Key: "disabled", Models: "disabled", Group: "plg", Priority: &priority, Weight: &weight},
		{Id: 3, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "orphan", Models: "no-ability", Group: "plg", Priority: &priority, Weight: &weight},
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "plg", Model: "ready", ChannelId: 1, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "plg", Model: "new-without-metadata", ChannelId: 1, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "plg", Model: "unpriced", ChannelId: 1, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "plg", Model: "ability-off", ChannelId: 1, Enabled: false, Priority: &priority, Weight: weight},
		{Group: "plg", Model: "disabled", ChannelId: 2, Enabled: false, Priority: &priority, Weight: weight},
	}).Error)
	setModelAccessBilling(t, map[string]float64{"ready": 1, "new-without-metadata": 1, "disabled": 1, "no-ability": 1, "ability-off": 1}, nil, nil)
	require.NoError(t, db.Create(&model.Model{ModelName: "ready", Status: 1}).Error)

	report, err := AuditModelCatalogReadiness("plg")
	require.NoError(t, err)
	require.Equal(t, 6, report.Configured)
	require.Equal(t, 2, report.Available)
	require.Equal(t, 4, report.Blocked)

	byModel := make(map[string]ModelCatalogReadiness, len(report.Models))
	for _, item := range report.Models {
		byModel[item.Model] = item
	}
	require.True(t, byModel["ready"].Available)
	require.True(t, byModel["ready"].HasBilling)
	require.True(t, byModel["ready"].HasMetadata)
	require.Empty(t, byModel["ready"].Issues)
	require.True(t, byModel["new-without-metadata"].Available)
	require.True(t, byModel["new-without-metadata"].HasBilling)
	require.False(t, byModel["new-without-metadata"].HasMetadata)
	requireIssueCodes(t, byModel["new-without-metadata"], CatalogIssueMetadataMissing)

	requireIssueCodes(t, byModel["disabled"], CatalogIssueAbilityDisabled, CatalogIssueChannelDisabled, CatalogIssueMetadataMissing)
	requireIssueCodes(t, byModel["ability-off"], CatalogIssueAbilityDisabled, CatalogIssueMetadataMissing)
	requireIssueCodes(t, byModel["no-ability"], CatalogIssueNoAbility, CatalogIssueMetadataMissing)
	requireIssueCodes(t, byModel["unpriced"], CatalogIssueBillingMissing, CatalogIssueMetadataMissing)
}

func requireIssueCodes(t *testing.T, item ModelCatalogReadiness, expected ...string) {
	t.Helper()
	codes := make([]string, 0, len(item.Issues))
	for _, issue := range item.Issues {
		codes = append(codes, issue.Code)
	}
	require.ElementsMatch(t, expected, codes)
}
