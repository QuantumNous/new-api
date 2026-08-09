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
	require.NoError(t, db.AutoMigrate(&Ticket{}, &TicketMessage{}, &TicketAttachment{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
	})
	return db
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
			_, err := AddTicketMessage(tt.ticketID, tt.userID, "reply", nil)
			assert.ErrorIs(t, err, tt.wantErr)
		})
	}

	var count int64
	require.NoError(t, db.Model(&TicketMessage{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestAddTicketMessagePreservesReplyableStatus(t *testing.T) {
	db := useTicketTestDB(t)
	for _, status := range []string{"open", "replied"} {
		t.Run(status, func(t *testing.T) {
			ticket := Ticket{UserID: 9, Title: status, Status: status}
			require.NoError(t, db.Create(&ticket).Error)

			message, err := AddTicketMessage(ticket.ID, ticket.UserID, "reply", nil)
			require.NoError(t, err)
			assert.Equal(t, ticket.ID, message.TicketID)

			require.NoError(t, db.First(&ticket, ticket.ID).Error)
			assert.Equal(t, status, ticket.Status)
			assert.Zero(t, ticket.ClosedAt)
		})
	}
}
