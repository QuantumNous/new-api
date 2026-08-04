package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserInviteesScopesIncludesDeletedAndPaginates(t *testing.T) {
	truncateTables(t)
	now := time.Now().In(time.Local)
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)

	inviter := User{
		Username: "invite-list-owner",
		AffCode:  "invite-list-owner-code",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(&inviter).Error)
	otherInviter := User{
		Username: "invite-list-other-owner",
		AffCode:  "invite-list-other-owner-code",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(&otherInviter).Error)

	invitees := []*User{
		{
			Username:    "invite-list-enabled",
			DisplayName: "Enabled Invitee",
			AffCode:     "invite-list-enabled-code",
			Status:      common.UserStatusEnabled,
			UsedQuota:   100,
			InviterId:   inviter.Id,
			CreatedAt:   startOfToday.Unix() + 1,
		},
		{
			Username:    "invite-list-disabled",
			DisplayName: "Disabled Invitee",
			AffCode:     "invite-list-disabled-code",
			Status:      common.UserStatusDisabled,
			UsedQuota:   200,
			InviterId:   inviter.Id,
			CreatedAt:   startOfToday.Unix() - 1,
		},
		{
			Username:    "invite-list-deleted",
			DisplayName: "Deleted Invitee",
			AffCode:     "invite-list-deleted-code",
			Status:      common.UserStatusEnabled,
			UsedQuota:   300,
			InviterId:   inviter.Id,
			CreatedAt:   startOfToday.Unix() + 2,
		},
		{
			Username:    "invite-list-unrelated",
			DisplayName: "Unrelated Invitee",
			AffCode:     "invite-list-unrelated-code",
			Status:      common.UserStatusEnabled,
			UsedQuota:   400,
			InviterId:   otherInviter.Id,
			CreatedAt:   startOfToday.Unix() + 3,
		},
	}
	require.NoError(t, DB.Create(invitees).Error)
	require.NoError(t, DB.Delete(invitees[2]).Error)

	pageOne, total, err := GetUserInvitees(inviter.Id, &common.PageInfo{Page: 1, PageSize: 2})
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	require.Len(t, pageOne, 2)
	assert.Equal(t, invitees[2].Id, pageOne[0].Id)
	assert.Equal(t, "D***e", pageOne[0].DisplayName)
	assert.Equal(t, startOfToday.Unix()+2, pageOne[0].CreatedAt)
	assert.True(t, pageOne[0].IsNew)
	assert.Equal(t, invitees[0].Id, pageOne[1].Id)
	assert.Equal(t, "E***e", pageOne[1].DisplayName)
	assert.True(t, pageOne[1].IsNew)
	payload, err := common.Marshal(pageOne[0])
	require.NoError(t, err)
	assert.NotContains(t, string(payload), "used_quota")
	assert.NotContains(t, string(payload), "status")
	assert.NotContains(t, string(payload), "deleted")

	pageTwo, total, err := GetUserInvitees(inviter.Id, &common.PageInfo{Page: 2, PageSize: 2})
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	require.Len(t, pageTwo, 1)
	assert.Equal(t, invitees[1].Id, pageTwo[0].Id)
	assert.Equal(t, "D***e", pageTwo[0].DisplayName)
	assert.False(t, pageTwo[0].IsNew)
}

func TestMaskInviteeDisplayName(t *testing.T) {
	tests := []struct {
		name        string
		displayName string
		want        string
	}{
		{name: "empty", displayName: "", want: "***"},
		{name: "one rune", displayName: "A", want: "*"},
		{name: "two unicode runes", displayName: "\u674e\u96f7", want: "\u674e*"},
		{name: "multiple runes", displayName: "Alice", want: "A***e"},
		{name: "trims whitespace", displayName: " Alice ", want: "A***e"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, maskInviteeDisplayName(test.displayName))
		})
	}
}
