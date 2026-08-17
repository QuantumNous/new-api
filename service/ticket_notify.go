package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/bytedance/gopkg/util/gopool"
)

func NotifyNewTicket(ticket model.Ticket) {
	gopool.Go(func() {
		NotifyRootUser(
			dto.NotifyTypeTicketUpdate,
			fmt.Sprintf("New ticket #%d", ticket.ID),
			fmt.Sprintf("A new %s ticket is waiting for support: %s", ticket.Category, ticket.Title),
		)
	})
}

func NotifyTicketUserReply(ticket model.Ticket) {
	gopool.Go(func() {
		if ticket.AssigneeID == nil {
			NotifyRootUser(
				dto.NotifyTypeTicketUpdate,
				fmt.Sprintf("Ticket #%d needs a reply", ticket.ID),
				fmt.Sprintf("The user added a message to an unassigned ticket: %s", ticket.Title),
			)
			return
		}
		notifyTicketUser(*ticket.AssigneeID, ticket.ID, "Ticket user replied", ticket.Title)
	})
}

func NotifyTicketSupportReply(ticket model.Ticket) {
	gopool.Go(func() {
		notifyTicketUser(ticket.UserID, ticket.ID, "Support replied to your ticket", ticket.Title)
	})
}

func NotifyTicketAssignment(ticket model.Ticket, assigneeID int) {
	gopool.Go(func() {
		notifyTicketUser(assigneeID, ticket.ID, "Ticket assigned to you", ticket.Title)
	})
}

func notifyTicketUser(userID, ticketID int, subject, title string) {
	user, err := model.GetUserById(userID, false)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to load ticket notification user %d: %s", userID, err.Error()))
		return
	}
	data := dto.NewNotify(
		dto.NotifyTypeTicketUpdate,
		fmt.Sprintf("%s (#%d)", subject, ticketID),
		title,
		nil,
	)
	if err := NotifyUser(user.Id, user.Email, user.GetSetting(), data); err != nil {
		common.SysLog(fmt.Sprintf("failed to notify user %d for ticket %d: %s", userID, ticketID, err.Error()))
	}
}
