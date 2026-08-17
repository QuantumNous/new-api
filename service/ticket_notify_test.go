package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	serviceauthz "github.com/QuantumNous/new-api/service/authz"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRenderEmailNotifyContentEscapesTicketText(t *testing.T) {
	content := renderEmailNotifyContent(dto.NewNotify(
		dto.NotifyTypeTicketUpdate,
		"Ticket update",
		`<a href="https://example.invalid">open</a> & review`,
		nil,
	))

	assert.Equal(t, `&lt;a href=&#34;https://example.invalid&#34;&gt;open&lt;/a&gt; &amp; review`, content)
}

func TestRenderEmailNotifyContentPreservesTrustedEmailMarkup(t *testing.T) {
	content := renderEmailNotifyContent(dto.NewNotify(
		dto.NotifyTypeQuotaExceed,
		"Quota update",
		"Remaining: {{value}}<br/>",
		[]interface{}{10},
	))

	assert.Equal(t, "Remaining: 10<br/>", content)
}

func TestGetEligibleTicketAgentRechecksCurrentAuthorization(t *testing.T) {
	previousDB := model.DB
	previousMaster := common.IsMasterNode
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CasbinRule{}, &model.AuthzRole{}))
	model.DB = db
	common.IsMasterNode = true
	require.NoError(t, serviceauthz.Init(db))
	t.Cleanup(func() {
		model.DB = previousDB
		common.IsMasterNode = previousMaster
	})

	agent := model.User{
		Id:       42,
		Username: "ticket-agent",
		Password: "disabled-test-password",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(&agent).Error)

	eligible, ok := getEligibleTicketAgent(agent.Id)
	require.True(t, ok)
	assert.Equal(t, agent.Id, eligible.Id)

	require.NoError(t, db.Model(&agent).Update("status", common.UserStatusDisabled).Error)
	_, ok = getEligibleTicketAgent(agent.Id)
	assert.False(t, ok)

	require.NoError(t, db.Model(&agent).Updates(map[string]interface{}{
		"status": common.UserStatusEnabled,
		"role":   common.RoleCommonUser,
	}).Error)
	_, ok = getEligibleTicketAgent(agent.Id)
	assert.False(t, ok)

	require.NoError(t, db.Model(&agent).Updates(map[string]interface{}{
		"status": common.UserStatusEnabled,
		"role":   common.RoleAdminUser,
	}).Error)
	require.NoError(t, serviceauthz.SetUserPermissions(agent.Id, serviceauthz.PermissionsMap{
		serviceauthz.ResourceTicket: {
			serviceauthz.ActionReply: false,
		},
	}))
	_, ok = getEligibleTicketAgent(agent.Id)
	assert.False(t, ok)
}
