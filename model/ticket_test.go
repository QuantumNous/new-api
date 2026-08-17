package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func useTicketTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Ticket{}, &TicketMessage{}, &TicketAttachment{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
	})
	return db
}

func TestSupportReplySetsRoleStatusAndAutomaticallyAssigns(t *testing.T) {
	db := useTicketTestDB(t)
	ticket := Ticket{UserID: 12, Title: "Needs support", Status: TicketStatusOpen}
	require.NoError(t, db.Create(&ticket).Error)

	message, updated, err := AddSupportTicketMessage(ticket.ID, 99, "support response", nil)
	require.NoError(t, err)
	assert.Equal(t, TicketMessageRoleSupport, message.Role)
	assert.Equal(t, TicketStatusReplied, updated.Status)
	require.NotNil(t, updated.AssigneeID)
	assert.Equal(t, 99, *updated.AssigneeID)
	assert.NotZero(t, updated.AssignedAt)

	require.NoError(t, db.First(&ticket, ticket.ID).Error)
	assert.Equal(t, TicketStatusReplied, ticket.Status)
	require.NotNil(t, ticket.AssigneeID)
	assert.Equal(t, 99, *ticket.AssigneeID)
}

func TestSupportReplyKeepsExistingAssignee(t *testing.T) {
	db := useTicketTestDB(t)
	assigneeID := 42
	ticket := Ticket{UserID: 12, AssigneeID: &assigneeID, AssignedAt: 100, Title: "Assigned", Status: TicketStatusOpen}
	require.NoError(t, db.Create(&ticket).Error)

	_, updated, err := AddSupportTicketMessage(ticket.ID, 99, "support response", nil)
	require.NoError(t, err)
	require.NotNil(t, updated.AssigneeID)
	assert.Equal(t, assigneeID, *updated.AssigneeID)
	assert.Equal(t, int64(100), updated.AssignedAt)
}

func TestTicketSummaryAggregatesMessagesWithoutRoleInference(t *testing.T) {
	db := useTicketTestDB(t)
	ticket := Ticket{UserID: 7, Title: "Aggregate", Status: TicketStatusReplied, UpdatedAt: 20}
	require.NoError(t, db.Create(&ticket).Error)
	require.NoError(t, db.Create(&[]TicketMessage{
		{TicketID: ticket.ID, AuthorID: ticket.UserID, Role: TicketMessageRoleUser, Content: "first", CreatedAt: 10},
		{TicketID: ticket.ID, AuthorID: ticket.UserID, Role: TicketMessageRoleSupport, Content: "second", CreatedAt: 20},
	}).Error)

	items, total, err := ListUserTickets(ticket.UserID, "", TicketStatusReplied, 1, 10)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, 2, items[0].MessageCount)
	assert.Equal(t, TicketMessageRoleSupport, items[0].LastReplyRole)
}

func TestAdminTicketFiltersAndQueueSummary(t *testing.T) {
	db := useTicketTestDB(t)
	requester := User{Id: 7, Username: "alice", DisplayName: "Alice", AffCode: "tk-user", Status: common.UserStatusEnabled}
	agent := User{Id: 20, Username: "support", DisplayName: "Support", AffCode: "tk-agent", Status: common.UserStatusEnabled, Role: common.RoleAdminUser}
	require.NoError(t, db.Create(&requester).Error)
	require.NoError(t, db.Create(&agent).Error)

	agentID := agent.Id
	matching := Ticket{
		UserID: requester.Id, AssigneeID: &agentID, Title: "API request failed",
		Category: "api", Priority: "high", Status: TicketStatusOpen, UpdatedAt: 30,
	}
	unassigned := Ticket{
		UserID: requester.Id, Title: "Billing question", Category: "billing",
		Priority: "normal", Status: TicketStatusOpen, UpdatedAt: 20,
	}
	replied := Ticket{
		UserID: requester.Id, AssigneeID: &agentID, Title: "Account reply",
		Category: "account", Priority: "low", Status: TicketStatusReplied, UpdatedAt: 10,
	}
	require.NoError(t, db.Create(&matching).Error)
	require.NoError(t, db.Create(&unassigned).Error)
	require.NoError(t, db.Create(&replied).Error)
	require.NoError(t, db.Create(&TicketMessage{
		TicketID: matching.ID, AuthorID: agent.Id, Role: TicketMessageRoleSupport,
		Content: "reply", CreatedAt: 30,
	}).Error)

	items, total, err := ListAdminTickets(AdminTicketFilter{
		Keyword: "Alice", Status: TicketStatusOpen, Category: "api",
		Priority: "high", AssigneeID: &agentID, Page: 1, PageSize: 20,
	})
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, matching.ID, items[0].ID)
	assert.Equal(t, requester.Username, items[0].UserName)
	assert.Equal(t, agent.Username, items[0].AssigneeName)
	assert.Equal(t, 1, items[0].MessageCount)
	assert.Equal(t, TicketMessageRoleSupport, items[0].LastReplyRole)

	summary, err := GetTicketQueueSummary(agent.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(2), summary.Pending)
	assert.Equal(t, int64(1), summary.Unassigned)
	assert.Equal(t, int64(2), summary.Mine)
}

func TestAssignTicketSupportsTransferAndUnassign(t *testing.T) {
	db := useTicketTestDB(t)
	ticket := Ticket{UserID: 7, Title: "Assignment", Status: TicketStatusOpen}
	require.NoError(t, db.Create(&ticket).Error)

	firstID := 20
	assigned, err := AssignTicket(ticket.ID, &firstID)
	require.NoError(t, err)
	require.NotNil(t, assigned.AssigneeID)
	assert.Equal(t, firstID, *assigned.AssigneeID)
	assert.NotZero(t, assigned.AssignedAt)

	secondID := 21
	transferred, err := AssignTicket(ticket.ID, &secondID)
	require.NoError(t, err)
	require.NotNil(t, transferred.AssigneeID)
	assert.Equal(t, secondID, *transferred.AssigneeID)

	unassigned, err := AssignTicket(ticket.ID, nil)
	require.NoError(t, err)
	assert.Nil(t, unassigned.AssigneeID)
	assert.Zero(t, unassigned.AssignedAt)
}

func TestAssignTicketNoopDoesNotTouchAssignment(t *testing.T) {
	db := useTicketTestDB(t)
	assigneeID := 20
	ticket := Ticket{UserID: 7, AssigneeID: &assigneeID, AssignedAt: 100, UpdatedAt: 100, Title: "Assignment", Status: TicketStatusOpen}
	require.NoError(t, db.Create(&ticket).Error)

	updated, changed, err := AssignTicketWithChange(ticket.ID, &assigneeID)
	require.NoError(t, err)
	assert.False(t, changed)
	assert.Equal(t, int64(100), updated.AssignedAt)
	assert.Equal(t, int64(100), updated.UpdatedAt)
}

func TestTicketAttachmentAccessIsScopedToOwner(t *testing.T) {
	db := useTicketTestDB(t)
	ticket := Ticket{UserID: 7, Title: "Attachment", Status: TicketStatusOpen}
	require.NoError(t, db.Create(&ticket).Error)
	attachment := TicketAttachment{TicketID: ticket.ID, MessageID: 1, StorageKey: "one.png"}
	require.NoError(t, db.Create(&attachment).Error)

	owned, err := GetUserTicketAttachment(ticket.UserID, attachment.ID)
	require.NoError(t, err)
	assert.Equal(t, attachment.ID, owned.ID)

	_, err = GetUserTicketAttachment(ticket.UserID+1, attachment.ID)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestAddTicketMessageRejectsClosedOrUnownedTicket(t *testing.T) {
	db := useTicketTestDB(t)
	closed := Ticket{UserID: 7, Title: "Closed", Status: "closed"}
	require.NoError(t, db.Create(&closed).Error)
	invalid := Ticket{UserID: 8, Title: "Invalid", Status: "unknown"}
	require.NoError(t, db.Create(&invalid).Error)

	tests := []struct {
		name     string
		ticketID int
		userID   int
		wantErr  error
	}{
		{name: "closed ticket", ticketID: closed.ID, userID: closed.UserID, wantErr: ErrTicketClosed},
		{name: "invalid status", ticketID: invalid.ID, userID: invalid.UserID, wantErr: ErrTicketStatusInvalid},
		{name: "different owner", ticketID: closed.ID, userID: closed.UserID + 1, wantErr: gorm.ErrRecordNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := AddTicketMessage(tt.ticketID, tt.userID, "reply", nil)
			assert.ErrorIs(t, err, tt.wantErr)
		})
	}

	var count int64
	require.NoError(t, db.Model(&TicketMessage{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestAddTicketMessageMovesReplyableStatusToOpen(t *testing.T) {
	db := useTicketTestDB(t)
	for _, status := range []string{"open", "replied"} {
		t.Run(status, func(t *testing.T) {
			ticket := Ticket{UserID: 9, Title: status, Status: status}
			require.NoError(t, db.Create(&ticket).Error)

			message, updated, err := AddTicketMessage(ticket.ID, ticket.UserID, "reply", nil)
			require.NoError(t, err)
			assert.Equal(t, ticket.ID, message.TicketID)
			assert.Equal(t, TicketMessageRoleUser, message.Role)
			assert.Equal(t, TicketStatusOpen, updated.Status)

			require.NoError(t, db.First(&ticket, ticket.ID).Error)
			assert.Equal(t, TicketStatusOpen, ticket.Status)
			assert.Zero(t, ticket.ClosedAt)
		})
	}
}
