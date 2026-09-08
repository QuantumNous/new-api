package model

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBackfillAgentCustomerBindingsIsChronologicalAndIdempotent(t *testing.T) {
	db := setupAgentCustomerModelDB(t)
	require.NoError(t, db.AutoMigrate(&Redemption{}))
	require.NoError(t, db.Create(&[]AgentAccount{
		{UserId: 7501, Status: AgentAccountStatusActive},
		{UserId: 7502, Status: AgentAccountStatusDisabled},
	}).Error)
	require.NoError(t, db.Create(&[]User{
		{Id: 7601, Username: "backfill-invite", AffCode: "backfill-invite-aff", InviterId: 7501, CreatedAt: 100},
		{Id: 7602, Username: "backfill-code", AffCode: "backfill-code-aff", CreatedAt: 100},
		{Id: 7603, Username: "backfill-conflict", AffCode: "backfill-conflict-aff", InviterId: 7501, CreatedAt: 100},
		{Id: 7604, Username: "backfill-existing", AffCode: "backfill-existing-aff", InviterId: 7501, BoundAgentId: 7502, BoundAt: 50, CreatedAt: 25},
		{Id: 7605, Username: "backfill-unresolved", AffCode: "backfill-unresolved-aff", InviterId: 7599, CreatedAt: 100},
	}).Error)
	require.NoError(t, db.Create(&[]Redemption{
		{Key: "61000000000000000000000000000001", Type: common.RedemptionCodeTypeQuota, Status: common.RedemptionCodeStatusUsed, UsedUserId: 7602, AgentUserId: 7502, RedeemedTime: 150},
		{Key: "61000000000000000000000000000002", Type: common.RedemptionCodeTypeQuota, Status: common.RedemptionCodeStatusUsed, UsedUserId: 7603, AgentUserId: 7502, RedeemedTime: 200},
	}).Error)

	report, err := BackfillAgentCustomerBindings(context.Background(), 2)
	require.NoError(t, err)
	assert.Equal(t, 3, report.Bound)
	assert.Equal(t, 1, report.Preserved)
	assert.Equal(t, 1, report.Unresolved)

	wantOwners := map[int]int{7601: 7501, 7602: 7502, 7603: 7501, 7604: 7502, 7605: 0}
	for userID, wantAgentID := range wantOwners {
		var user User
		require.NoError(t, db.First(&user, userID).Error)
		assert.Equal(t, wantAgentID, user.BoundAgentId)
	}

	second, err := BackfillAgentCustomerBindings(context.Background(), 2)
	require.NoError(t, err)
	assert.Zero(t, second.Bound)
	assert.Equal(t, 4, second.Preserved)
	assert.Equal(t, 1, second.Unresolved)
}
