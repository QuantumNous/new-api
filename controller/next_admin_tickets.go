package controller

import (
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	serviceauthz "github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type nextAdminTicketUserDTO struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email,omitempty"`
}

type nextAdminTicketDTO struct {
	nextTicketDTO
	AssigneeID   *int                   `json:"assignee_id"`
	AssigneeName string                 `json:"assignee_name,omitempty"`
	AssignedAt   int64                  `json:"assigned_at"`
	User         nextAdminTicketUserDTO `json:"user"`
}

func buildNextAdminTicketSummaryDTO(summary *model.TicketSummary) nextAdminTicketDTO {
	return nextAdminTicketDTO{
		nextTicketDTO: buildNextTicketSummaryDTO(summary),
		AssigneeID:    summary.AssigneeID,
		AssigneeName:  summary.AssigneeName,
		AssignedAt:    summary.AssignedAt,
		User: nextAdminTicketUserDTO{
			ID:          summary.UserID,
			Username:    summary.UserName,
			DisplayName: summary.UserDisplayName,
		},
	}
}

func buildNextAdminTicketDTO(ticket *model.Ticket, messages []model.TicketMessage, user *model.User, assigneeName string) nextAdminTicketDTO {
	return nextAdminTicketDTO{
		nextTicketDTO: buildNextTicketDTO(ticket, messages),
		AssigneeID:    ticket.AssigneeID,
		AssigneeName:  assigneeName,
		AssignedAt:    ticket.AssignedAt,
		User: nextAdminTicketUserDTO{
			ID:          user.Id,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			Email:       user.Email,
		},
	}
}

func NextListAdminTickets(c *gin.Context) {
	page := 1
	pageSize := 20
	if value, err := strconv.Atoi(c.Query("page")); err == nil && value > 0 {
		page = value
	}
	if value, err := strconv.Atoi(c.Query("page_size")); err == nil && value > 0 && value <= 100 {
		pageSize = value
	}
	status := strings.TrimSpace(c.Query("status"))
	category := strings.TrimSpace(c.Query("category"))
	priority := strings.TrimSpace(c.Query("priority"))
	if status != "" && !model.IsTicketStatus(status) {
		nextBusinessError(c, "invalid ticket status", "VALIDATION_ERROR")
		return
	}
	if category != "" && !validNextTicketCategory(category) {
		nextBusinessError(c, "invalid ticket category", "VALIDATION_ERROR")
		return
	}
	if priority != "" && !validNextTicketPriority(priority) {
		nextBusinessError(c, "invalid ticket priority", "VALIDATION_ERROR")
		return
	}
	filter := model.AdminTicketFilter{
		Keyword:  c.Query("keyword"),
		Status:   status,
		Category: category,
		Priority: priority,
		Page:     page,
		PageSize: pageSize,
	}
	assignee := strings.TrimSpace(c.Query("assignee"))
	if assignee != "" {
		assigneeID := 0
		switch assignee {
		case "unassigned":
		case "mine":
			assigneeID = c.GetInt("id")
		default:
			parsed, err := strconv.Atoi(assignee)
			if err != nil || parsed <= 0 {
				nextBusinessError(c, "invalid ticket assignee", "VALIDATION_ERROR")
				return
			}
			assigneeID = parsed
		}
		filter.AssigneeID = &assigneeID
	}
	items, total, err := model.ListAdminTickets(filter)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result := make([]nextAdminTicketDTO, 0, len(items))
	for index := range items {
		result = append(result, buildNextAdminTicketSummaryDTO(&items[index]))
	}
	common.ApiSuccess(c, gin.H{"items": result, "total": total, "page": page, "page_size": pageSize})
}

func NextGetAdminTicketSummary(c *gin.Context) {
	summary, err := model.GetTicketQueueSummary(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func NextListAdminTicketAgents(c *gin.Context) {
	users, err := model.ListEnabledTicketAgents()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	agents := make([]nextAdminTicketUserDTO, 0, len(users))
	for index := range users {
		user := &users[index]
		if !serviceauthz.Can(user.Id, user.Role, serviceauthz.TicketReply) {
			continue
		}
		agents = append(agents, nextAdminTicketUserDTO{
			ID:          user.Id,
			Username:    user.Username,
			DisplayName: user.DisplayName,
		})
	}
	common.ApiSuccess(c, gin.H{"items": agents})
}

func NextGetAdminTicket(c *gin.Context) {
	ticketID, ok := nextTicketID(c)
	if !ok {
		return
	}
	ticket, err := model.GetTicket(ticketID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		nextTicketNotFound(c)
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	messages, err := model.ListTicketMessages(ticket.ID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	attachments, err := model.ListTicketAttachments(ticket.ID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(ticket.UserID, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	assigneeName := ""
	if ticket.AssigneeID != nil {
		if assignee, getErr := model.GetUserById(*ticket.AssigneeID, false); getErr == nil {
			assigneeName = assignee.Username
		}
	}
	common.ApiSuccess(c, gin.H{
		"ticket":   buildNextAdminTicketDTO(ticket, messages, user, assigneeName),
		"messages": buildNextTicketMessages(messages, attachments, "/api/next/admin/tickets/attachments"),
	})
}

func NextAddAdminTicketMessage(c *gin.Context) {
	ticketID, ok := nextTicketID(c)
	if !ok {
		return
	}
	before, err := model.GetTicket(ticketID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		nextTicketNotFound(c)
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxTicketRequestSize)
	form, err := c.MultipartForm()
	if err != nil {
		nextBusinessError(c, "invalid multipart request", "VALIDATION_ERROR")
		return
	}
	defer form.RemoveAll()
	content := strings.TrimSpace(c.PostForm("content"))
	if content == "" || len([]rune(content)) > 2000 {
		nextBusinessError(c, "ticket content is required and must not exceed 2000 characters", "VALIDATION_ERROR")
		return
	}
	attachments, paths, err := saveNextTicketAttachments(form.File["attachments"])
	if err != nil {
		nextBusinessError(c, err.Error(), "VALIDATION_ERROR")
		return
	}
	message, updatedTicket, err := model.AddSupportTicketMessage(ticketID, c.GetInt("id"), content, attachments)
	if err != nil {
		removeNextTicketFiles(paths)
		if errors.Is(err, model.ErrTicketClosed) {
			nextBusinessError(c, "closed tickets cannot receive replies", "TICKET_CLOSED")
			return
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			nextTicketNotFound(c)
			return
		}
		common.ApiError(c, err)
		return
	}
	storedAttachments, err := model.ListTicketAttachments(ticketID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "ticket.reply", map[string]interface{}{
		"ticket_id":     ticketID,
		"auto_assigned": before.AssigneeID == nil,
	})
	service.NotifyTicketSupportReply(*updatedTicket)
	items := buildNextTicketMessages([]model.TicketMessage{*message}, storedAttachments, "/api/next/admin/tickets/attachments")
	common.ApiSuccess(c, gin.H{"message": items[0], "ticket": gin.H{
		"status":      updatedTicket.Status,
		"assignee_id": updatedTicket.AssigneeID,
		"assigned_at": updatedTicket.AssignedAt,
		"updated":     updatedTicket.UpdatedAt,
	}})
}

func NextUpdateAdminTicketStatus(c *gin.Context) {
	ticketID, ok := nextTicketID(c)
	if !ok {
		return
	}
	var request struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		nextBusinessError(c, "invalid status", "VALIDATION_ERROR")
		return
	}
	ticket, err := model.UpdateAdminTicketStatus(ticketID, c.GetInt("id"), request.Status)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		nextTicketNotFound(c)
		return
	}
	if err != nil {
		nextBusinessError(c, err.Error(), "VALIDATION_ERROR")
		return
	}
	recordManageAudit(c, "ticket.status_update", map[string]interface{}{"ticket_id": ticketID, "status": ticket.Status})
	common.ApiSuccess(c, gin.H{"ticket": gin.H{"id": ticket.ID, "status": ticket.Status, "updated": ticket.UpdatedAt}})
}

func NextAssignAdminTicket(c *gin.Context) {
	ticketID, ok := nextTicketID(c)
	if !ok {
		return
	}
	var request struct {
		AssigneeID *int `json:"assignee_id"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		nextBusinessError(c, "invalid assignee", "VALIDATION_ERROR")
		return
	}
	if request.AssigneeID != nil {
		if *request.AssigneeID <= 0 {
			nextBusinessError(c, "invalid assignee", "VALIDATION_ERROR")
			return
		}
		assignee, err := model.GetUserById(*request.AssigneeID, false)
		if err != nil || assignee.Status != common.UserStatusEnabled || !serviceauthz.Can(assignee.Id, assignee.Role, serviceauthz.TicketReply) {
			nextBusinessError(c, "ticket assignee is not available", "VALIDATION_ERROR")
			return
		}
	}
	ticket, changed, err := model.AssignTicketWithChange(ticketID, request.AssigneeID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		nextTicketNotFound(c)
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	params := map[string]interface{}{"ticket_id": ticketID}
	if request.AssigneeID != nil {
		params["assignee_id"] = *request.AssigneeID
	} else {
		params["assignee_id"] = nil
	}
	if changed {
		recordManageAudit(c, "ticket.assign", params)
	}
	if changed && request.AssigneeID != nil {
		service.NotifyTicketAssignment(*ticket, *request.AssigneeID)
	}
	common.ApiSuccess(c, gin.H{"ticket": gin.H{
		"id":          ticket.ID,
		"assignee_id": ticket.AssigneeID,
		"assigned_at": ticket.AssignedAt,
		"updated":     ticket.UpdatedAt,
	}})
}

func NextDownloadAdminTicketAttachment(c *gin.Context) {
	attachmentID, err := strconv.Atoi(c.Param("attachment_id"))
	if err != nil || attachmentID <= 0 {
		nextBusinessError(c, "invalid attachment id", "VALIDATION_ERROR")
		return
	}
	attachment, err := model.GetTicketAttachment(attachmentID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		nextTicketNotFound(c)
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	path := filepath.Join(nextTicketStorageDir(), filepath.Base(attachment.StorageKey))
	c.Header("Content-Type", attachment.MimeType)
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", attachment.OriginalName))
	c.Header("Cache-Control", "private, max-age=300")
	c.File(path)
}
