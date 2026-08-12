package model

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRecallCampaignDueQueryExcludesContinuousCampaigns(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	due := []RecallCampaign{
		{Name: "scheduled due", Status: RecallCampaignScheduled, AudienceConfig: `{}`, ExecutionMode: "scheduled_once", NextRunAt: 100, DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`},
		{Name: "recurring due", Status: RecallCampaignRunning, AudienceConfig: `{}`, ExecutionMode: "recurring", NextRunAt: 100, DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`},
		{Name: "continuous not due", Status: RecallCampaignRunning, AudienceConfig: `{}`, ExecutionMode: "continuous", NextRunAt: 100, DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`},
	}
	require.NoError(t, DB.Create(&due).Error)

	campaigns, err := ListDueRecallCampaignsWithContext(context.Background(), 100, 10)

	require.NoError(t, err)
	require.Len(t, campaigns, 2)
	require.Equal(t, "scheduled_once", campaigns[0].ExecutionMode)
	require.Equal(t, "recurring", campaigns[1].ExecutionMode)
}
