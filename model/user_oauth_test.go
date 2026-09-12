package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestInsertWithTxStoresInviterId(t *testing.T) {
	testCases := []struct {
		name      string
		username  string
		inviterId int
	}{
		{
			name:      "with inviter",
			username:  "oauth_invitee_with",
			inviterId: 42,
		},
		{
			name:      "without inviter",
			username:  "oauth_invitee_without",
			inviterId: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			user := &User{
				Username: tc.username,
				Role:     common.RoleCommonUser,
				Status:   common.UserStatusEnabled,
			}

			err := DB.Transaction(func(tx *gorm.DB) error {
				return user.InsertWithTx(tx, tc.inviterId)
			})
			require.NoError(t, err)

			var created User
			require.NoError(t, DB.Select("inviter_id").First(&created, user.Id).Error)
			assert.Equal(t, tc.inviterId, created.InviterId)
		})
	}
}
