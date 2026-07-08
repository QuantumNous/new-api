package model

import (
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupOrganizationTestState(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Exec("DELETE FROM logs").Error)
	require.NoError(t, DB.Exec("DELETE FROM organization_members").Error)
	require.NoError(t, DB.Exec("DELETE FROM organizations").Error)
	require.NoError(t, DB.Exec("DELETE FROM users").Error)
	truncateTables(t)
}

func insertOrganizationTestUser(t *testing.T, id int, username string) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:          id,
		Username:    username,
		DisplayName: username + " display",
		Email:       username + "@example.com",
		Password:    "password",
		Status:      common.UserStatusEnabled,
		AffCode:     username + "-aff",
	}).Error)
}

func createOrganizationBillingTestFixture(t *testing.T) int {
	t.Helper()
	insertOrganizationTestUser(t, 10, "owner")
	insertOrganizationTestUser(t, 11, "member")

	require.NoError(t, DB.Create(&Organization{
		Id:      100,
		Name:    "usage org",
		OwnerId: 10,
		Status:  OrganizationStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&OrganizationMember{
		OrganizationId: 100,
		UserId:         10,
		Role:           OrganizationRoleOwner,
		JoinedAt:       0,
		CurrentKey:     activeOrganizationCurrentKey(10),
	}).Error)
	require.NoError(t, DB.Create(&OrganizationMember{
		OrganizationId: 100,
		UserId:         11,
		Role:           OrganizationRoleMember,
		JoinedAt:       0,
		CurrentKey:     activeOrganizationCurrentKey(11),
	}).Error)
	return 100
}

func TestAddOrganizationMemberRejectsSecondActiveOrganization(t *testing.T) {
	setupOrganizationTestState(t)
	insertOrganizationTestUser(t, 1, "owner-one")
	insertOrganizationTestUser(t, 2, "owner-two")
	insertOrganizationTestUser(t, 3, "member")

	orgOne, err := CreateOrganization("org one")
	require.NoError(t, err)
	orgTwo, err := CreateOrganization("org two")
	require.NoError(t, err)

	_, err = AddOrganizationMember(orgOne.Id, 3, OrganizationRoleMember, false)
	require.NoError(t, err)

	_, err = AddOrganizationMember(orgTwo.Id, 3, OrganizationRoleBilling, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already belongs")
}

func TestCreateOrganizationDoesNotCreateMember(t *testing.T) {
	setupOrganizationTestState(t)

	org, err := CreateOrganization("empty org")
	require.NoError(t, err)
	assert.Equal(t, 0, org.OwnerId)

	members, err := ListOrganizationMembers(org.Id, true)
	require.NoError(t, err)
	assert.Empty(t, members)
}

func TestAdminCanAssignInitialOrganizationOwner(t *testing.T) {
	setupOrganizationTestState(t)
	insertOrganizationTestUser(t, 1, "owner-one")
	insertOrganizationTestUser(t, 2, "owner-two")

	org, err := CreateOrganization("org")
	require.NoError(t, err)

	member, err := AddOrganizationMember(org.Id, 1, OrganizationRoleOwner, true)
	require.NoError(t, err)
	assert.Equal(t, OrganizationRoleOwner, member.Role)

	updated, err := GetOrganizationById(org.Id)
	require.NoError(t, err)
	assert.Equal(t, 1, updated.OwnerId)

	_, err = AddOrganizationMember(org.Id, 2, OrganizationRoleOwner, true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "owner already exists")
}

func TestOrganizationBillingSummaryUsesMembershipWindow(t *testing.T) {
	setupOrganizationTestState(t)
	insertOrganizationTestUser(t, 10, "owner")
	insertOrganizationTestUser(t, 11, "member")

	require.NoError(t, DB.Create(&Organization{
		Id:      100,
		Name:    "usage org",
		OwnerId: 10,
		Status:  OrganizationStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&OrganizationMember{
		OrganizationId: 100,
		UserId:         10,
		Role:           OrganizationRoleOwner,
		JoinedAt:       50,
		CurrentKey:     activeOrganizationCurrentKey(10),
	}).Error)
	require.NoError(t, DB.Create(&OrganizationMember{
		OrganizationId: 100,
		UserId:         11,
		Role:           OrganizationRoleMember,
		JoinedAt:       100,
		LeftAt:         200,
	}).Error)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 11, Username: "member", CreatedAt: 90, Type: LogTypeConsume, Quota: 100, PromptTokens: 1},
		{UserId: 11, Username: "member", CreatedAt: 120, Type: LogTypeConsume, Quota: 200, PromptTokens: 2, CompletionTokens: 3, ModelName: "gpt-a", ChannelId: 7},
		{UserId: 11, Username: "member", CreatedAt: 199, Type: LogTypeConsume, Quota: 300, PromptTokens: 4, CompletionTokens: 5, ModelName: "gpt-b", ChannelId: 8},
		{UserId: 11, Username: "member", CreatedAt: 200, Type: LogTypeConsume, Quota: 400, PromptTokens: 6},
		{UserId: 11, Username: "member", CreatedAt: 150, Type: LogTypeRefund, Quota: -50},
		{UserId: 10, Username: "owner", CreatedAt: 150, Type: LogTypeConsume, Quota: 25},
	}).Error)

	summary, err := GetOrganizationBillingSummary(100, OrganizationBillingFilters{Types: []int{LogTypeConsume}})
	require.NoError(t, err)

	assert.Equal(t, 525, summary.TotalQuota)
	assert.Equal(t, 3, summary.RequestCount)
	assert.Equal(t, 6, summary.PromptTokens)
	assert.Equal(t, 8, summary.CompletionTokens)
	assert.Equal(t, 2, summary.MemberCount)
	assert.Equal(t, 1, summary.ActiveMemberCount)
}

func TestOrganizationBillingMembersAggregatesAndHydratesUsers(t *testing.T) {
	setupOrganizationTestState(t)
	organizationId := createOrganizationBillingTestFixture(t)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 10, Username: "owner", CreatedAt: 110, Type: LogTypeConsume, Quota: 100, PromptTokens: 1, CompletionTokens: 2},
		{UserId: 10, Username: "owner", CreatedAt: 120, Type: LogTypeConsume, Quota: 250, PromptTokens: 3, CompletionTokens: 4},
		{UserId: 11, Username: "member", CreatedAt: 130, Type: LogTypeConsume, Quota: 200, PromptTokens: 5, CompletionTokens: 6},
		{UserId: 11, Username: "member", CreatedAt: 140, Type: LogTypeRefund, Quota: -50},
	}).Error)

	items, err := GetOrganizationBillingMembers(organizationId, OrganizationBillingFilters{Types: []int{LogTypeConsume}})
	require.NoError(t, err)
	require.Len(t, items, 2)

	assert.Equal(t, 10, items[0].UserId)
	assert.Equal(t, "owner", items[0].Username)
	assert.Equal(t, "owner display", items[0].DisplayName)
	assert.Equal(t, 350, items[0].TotalQuota)
	assert.Equal(t, 2, items[0].RequestCount)
	assert.Equal(t, 4, items[0].PromptTokens)
	assert.Equal(t, 6, items[0].CompletionTokens)
	assert.Equal(t, 11, items[1].UserId)
	assert.Equal(t, 200, items[1].TotalQuota)
}

func TestOrganizationBillingModelsAggregatesAndAttachesPricingSnapshot(t *testing.T) {
	setupOrganizationTestState(t)
	organizationId := createOrganizationBillingTestFixture(t)
	require.NoError(t, DB.Create(&Channel{
		Id:     7,
		Type:   1,
		Key:    "test-key",
		Name:   "primary",
		Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-4",
		ChannelId: 7,
		Enabled:   true,
	}).Error)
	InvalidatePricingCache()
	t.Cleanup(InvalidatePricingCache)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 10, CreatedAt: 110, Type: LogTypeConsume, ModelName: "gpt-4", Quota: 100, PromptTokens: 1},
		{UserId: 11, CreatedAt: 120, Type: LogTypeConsume, ModelName: "gpt-4", Quota: 200, CompletionTokens: 2},
		{UserId: 11, CreatedAt: 130, Type: LogTypeConsume, ModelName: "gpt-4o-mini", Quota: 50},
	}).Error)

	items, err := GetOrganizationBillingModels(organizationId, OrganizationBillingFilters{Types: []int{LogTypeConsume}})
	require.NoError(t, err)
	require.Len(t, items, 2)

	assert.Equal(t, "gpt-4", items[0].ModelName)
	assert.Equal(t, 300, items[0].TotalQuota)
	assert.Equal(t, 2, items[0].RequestCount)
	require.NotNil(t, items[0].Pricing)
	assert.Equal(t, 0, items[0].Pricing.QuotaType)
	assert.Greater(t, items[0].Pricing.ModelRatio, 0.0)
	assert.Equal(t, "gpt-4o-mini", items[1].ModelName)
	assert.Nil(t, items[1].Pricing)
}

func TestOrganizationBillingChannelsAggregatesAndHydratesNames(t *testing.T) {
	setupOrganizationTestState(t)
	organizationId := createOrganizationBillingTestFixture(t)
	require.NoError(t, DB.Create(&[]Channel{
		{Id: 7, Key: "channel-seven", Name: "primary", Status: common.ChannelStatusEnabled},
		{Id: 8, Key: "channel-eight", Name: "fallback", Status: common.ChannelStatusEnabled},
	}).Error)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 10, CreatedAt: 110, Type: LogTypeConsume, ChannelId: 7, Quota: 100},
		{UserId: 11, CreatedAt: 120, Type: LogTypeConsume, ChannelId: 7, Quota: 200},
		{UserId: 11, CreatedAt: 130, Type: LogTypeConsume, ChannelId: 8, Quota: 50},
	}).Error)

	items, err := GetOrganizationBillingChannels(organizationId, OrganizationBillingFilters{Types: []int{LogTypeConsume}})
	require.NoError(t, err)
	require.Len(t, items, 2)

	assert.Equal(t, 7, items[0].ChannelId)
	assert.Equal(t, "primary", items[0].ChannelName)
	assert.Equal(t, 300, items[0].TotalQuota)
	assert.Equal(t, 2, items[0].RequestCount)
	assert.Equal(t, 8, items[1].ChannelId)
	assert.Equal(t, "fallback", items[1].ChannelName)
}

func TestOrganizationBillingTrendAggregatesByUtcDay(t *testing.T) {
	setupOrganizationTestState(t)
	organizationId := createOrganizationBillingTestFixture(t)
	firstDay := time.Date(2026, 7, 8, 0, 30, 0, 0, time.UTC).Unix()
	firstDayLate := time.Date(2026, 7, 8, 23, 59, 0, 0, time.UTC).Unix()
	secondDay := time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC).Unix()
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 10, CreatedAt: firstDay, Type: LogTypeConsume, Quota: 100, PromptTokens: 1},
		{UserId: 11, CreatedAt: firstDayLate, Type: LogTypeConsume, Quota: 200, CompletionTokens: 2},
		{UserId: 10, CreatedAt: secondDay, Type: LogTypeConsume, Quota: 300, PromptTokens: 3, CompletionTokens: 4},
	}).Error)

	points, err := GetOrganizationBillingTrend(organizationId, OrganizationBillingFilters{Types: []int{LogTypeConsume}})
	require.NoError(t, err)
	require.Len(t, points, 2)

	assert.Equal(t, "2026-07-08", points[0].Period)
	assert.Equal(t, 300, points[0].TotalQuota)
	assert.Equal(t, 2, points[0].RequestCount)
	assert.Equal(t, 1, points[0].PromptTokens)
	assert.Equal(t, 2, points[0].CompletionTokens)
	assert.Equal(t, "2026-07-09", points[1].Period)
	assert.Equal(t, 300, points[1].TotalQuota)
}

func TestOrganizationBillingLogsPaginatesAcrossMembers(t *testing.T) {
	setupOrganizationTestState(t)
	organizationId := createOrganizationBillingTestFixture(t)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 10, CreatedAt: 100, Type: LogTypeConsume, Quota: 100},
		{UserId: 11, CreatedAt: 95, Type: LogTypeConsume, Quota: 95},
		{UserId: 10, CreatedAt: 90, Type: LogTypeConsume, Quota: 90},
		{UserId: 11, CreatedAt: 85, Type: LogTypeConsume, Quota: 85},
		{UserId: 10, CreatedAt: 80, Type: LogTypeConsume, Quota: 80},
		{UserId: 11, CreatedAt: 75, Type: LogTypeConsume, Quota: 75},
	}).Error)

	logs, total, err := GetOrganizationBillingLogs(organizationId, OrganizationBillingFilters{Types: []int{LogTypeConsume}}, 2, 3)
	require.NoError(t, err)
	assert.Equal(t, int64(6), total)
	require.Len(t, logs, 3)
	assert.Equal(t, 90, logs[0].Quota)
	assert.Equal(t, 85, logs[1].Quota)
	assert.Equal(t, 80, logs[2].Quota)
}

func TestListOrganizationsFiltersByKeywordAndStatus(t *testing.T) {
	setupOrganizationTestState(t)
	insertOrganizationTestUser(t, 20, "owner-alpha")
	insertOrganizationTestUser(t, 21, "owner-beta")
	insertOrganizationTestUser(t, 22, "owner-gamma")

	alpha, err := CreateOrganization("alpha org")
	require.NoError(t, err)
	_, err = AddOrganizationMember(alpha.Id, 20, OrganizationRoleOwner, true)
	require.NoError(t, err)
	beta, err := CreateOrganization("beta org")
	require.NoError(t, err)
	_, err = AddOrganizationMember(beta.Id, 21, OrganizationRoleOwner, true)
	require.NoError(t, err)
	_, err = CreateOrganization("gamma org")
	require.NoError(t, err)
	disabledStatus := OrganizationStatusDisabled
	_, err = UpdateOrganization(beta.Id, "", &disabledStatus)
	require.NoError(t, err)

	items, total, err := ListOrganizations("owner-beta", &disabledStatus, 0, 10)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, beta.Id, items[0].Id)

	enabledStatus := OrganizationStatusEnabled
	items, total, err = ListOrganizations("owner-beta", &enabledStatus, 0, 10)
	require.NoError(t, err)
	assert.Empty(t, items)
	assert.Equal(t, int64(0), total)

	items, total, err = ListOrganizations(strconv.Itoa(alpha.Id), &enabledStatus, 0, 10)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, alpha.Id, items[0].Id)
}
