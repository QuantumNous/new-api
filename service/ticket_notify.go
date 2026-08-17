package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	serviceauthz "github.com/QuantumNous/new-api/service/authz"
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
			notifyRootAboutTicketReply(ticket)
			return
		}
		agent, ok := getEligibleTicketAgent(*ticket.AssigneeID)
		if !ok {
			notifyRootAboutTicketReply(ticket)
			return
		}
		notifyLoadedTicketUser(agent, ticket.ID, "Ticket user replied", ticket.Title)
	})
}

func NotifyTicketSupportReply(ticket model.Ticket) {
	gopool.Go(func() {
		notifyTicketUser(ticket.UserID, ticket.ID, "Support replied to your ticket", ticket.Title)
	})
}

func NotifyTicketAssignment(ticket model.Ticket, assigneeID int) {
	gopool.Go(func() {
		agent, ok := getEligibleTicketAgent(assigneeID)
		if !ok {
			return
		}
		notifyLoadedTicketUser(agent, ticket.ID, "Ticket assigned to you", ticket.Title)
	})
}

func notifyRootAboutTicketReply(ticket model.Ticket) {
	NotifyRootUser(
		dto.NotifyTypeTicketUpdate,
		fmt.Sprintf("Ticket #%d needs a reply", ticket.ID),
		fmt.Sprintf("The user added a message to an unassigned ticket: %s", ticket.Title),
	)
}

func getEligibleTicketAgent(userID int) (*model.User, bool) {
	user, err := model.GetUserById(userID, false)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to load ticket agent %d for notification: %s", userID, err.Error()))
		return nil, false
	}
	if user.Status != common.UserStatusEnabled || !serviceauthz.Can(user.Id, user.Role, serviceauthz.TicketReply) {
		common.SysLog(fmt.Sprintf("ticket agent %d is no longer eligible for notifications", userID))
		return nil, false
	}
	return user, true
}

func notifyTicketUser(userID, ticketID int, subject, title string) {
	user, err := model.GetUserById(userID, false)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to load ticket notification user %d: %s", userID, err.Error()))
		return
	}
	notifyLoadedTicketUser(user, ticketID, subject, title)
}

func notifyLoadedTicketUser(user *model.User, ticketID int, subject, title string) {
	data := dto.NewNotify(
		dto.NotifyTypeTicketUpdate,
		fmt.Sprintf("%s (#%d)", subject, ticketID),
		title,
		nil,
	)
	if err := NotifyUser(user.Id, user.Email, user.GetSetting(), data); err != nil {
		common.SysLog(fmt.Sprintf("failed to notify user %d for ticket %d: %s", user.Id, ticketID, err.Error()))
	}
}
