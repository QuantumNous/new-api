package controller

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// User-facing ticket endpoints
// ============================================================================

// GetUserTickets lists tickets for the current user
func GetUserTickets(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	tickets, total, err := model.GetUserTickets(userId, page, pageSize, status)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to get user tickets: %v", err))
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取工单列表失败",
		})
		return
	}

	var ticketResponses []dto.TicketResponse
	for _, ticket := range tickets {
		ticketResponses = append(ticketResponses, dto.TicketResponse{
			Id:         ticket.Id,
			UserId:     ticket.UserId,
			Title:      ticket.Title,
			Content:    ticket.Content,
			Category:   ticket.Category,
			Status:     ticket.Status,
			Priority:   ticket.Priority,
			AssignedTo: ticket.AssignedTo,
			ClosedAt:   ticket.ClosedAt,
			CreatedAt:  ticket.CreatedAt,
			UpdatedAt:  ticket.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": dto.TicketListData{
			Tickets: ticketResponses,
			Total:   total,
			Page:    page,
			Size:    pageSize,
		},
	})
}

// CreateTicket creates a new ticket
func CreateTicket(c *gin.Context) {
	userId := c.GetInt("id")
	var req dto.CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	if req.Title == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "标题不能为空",
		})
		return
	}
	if req.Content == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "内容不能为空",
		})
		return
	}
	if req.Category == "" {
		req.Category = model.TicketCategoryGeneral
	}
	if req.Priority == "" {
		req.Priority = model.TicketPriorityMedium
	}

	// Validate category
	validCategory := false
	for _, c := range model.ValidTicketCategories {
		if c == req.Category {
			validCategory = true
			break
		}
	}
	if !validCategory {
		req.Category = model.TicketCategoryGeneral
	}

	// Validate priority
	validPriority := false
	for _, p := range model.ValidTicketPriorities {
		if p == req.Priority {
			validPriority = true
			break
		}
	}
	if !validPriority {
		req.Priority = model.TicketPriorityMedium
	}

	ticket := &model.Ticket{
		UserId:   userId,
		Title:    req.Title,
		Content:  req.Content,
		Category: req.Category,
		Priority: req.Priority,
		Status:   model.TicketStatusOpen,
	}

	if err := model.CreateTicket(ticket); err != nil {
		common.SysError(fmt.Sprintf("failed to create ticket: %v", err))
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "创建工单失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "工单创建成功",
		"data": dto.TicketResponse{
			Id:        ticket.Id,
			UserId:    ticket.UserId,
			Title:     ticket.Title,
			Content:   ticket.Content,
			Category:  ticket.Category,
			Status:    ticket.Status,
			Priority:  ticket.Priority,
			CreatedAt: ticket.CreatedAt,
			UpdatedAt: ticket.UpdatedAt,
		},
	})
}

// GetTicket gets ticket details with messages
func GetTicket(c *gin.Context) {
	userId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的工单ID",
		})
		return
	}

	ticket, err := model.GetTicketById(ticketId, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "工单不存在",
		})
		return
	}

	// Get messages (non-internal only for user)
	messages, err := model.GetTicketMessages(ticketId, false)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to get ticket messages: %v", err))
	}

	var msgDTOs []dto.TicketMessageDTO
	for _, msg := range messages {
		msgDTOs = append(msgDTOs, dto.TicketMessageDTO{
			Id:        msg.Id,
			UserId:    msg.UserId,
			Content:   msg.Content,
			CreatedAt: msg.CreatedAt,
		})
	}
	if msgDTOs == nil {
		msgDTOs = []dto.TicketMessageDTO{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": dto.TicketResponse{
			Id:         ticket.Id,
			UserId:     ticket.UserId,
			Title:      ticket.Title,
			Content:    ticket.Content,
			Category:   ticket.Category,
			Status:     ticket.Status,
			Priority:   ticket.Priority,
			AssignedTo: ticket.AssignedTo,
			ClosedAt:   ticket.ClosedAt,
			CreatedAt:  ticket.CreatedAt,
			UpdatedAt:  ticket.UpdatedAt,
			Messages:   msgDTOs,
		},
	})
}

// AddTicketMessage adds a message to a ticket
func AddTicketMessage(c *gin.Context) {
	userId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的工单ID",
		})
		return
	}

	var req dto.AddTicketMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	if req.Content == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "内容不能为空",
		})
		return
	}

	// Verify ticket ownership
	_, err = model.GetTicketById(ticketId, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "工单不存在",
		})
		return
	}

	msg := &model.TicketMessage{
		TicketId:   ticketId,
		UserId:     userId,
		Content:    req.Content,
		IsInternal: false,
	}

	if err := model.AddTicketMessage(msg); err != nil {
		common.SysError(fmt.Sprintf("failed to add ticket message: %v", err))
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "回复失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "回复成功",
	})
}

// CloseTicket closes a ticket
func CloseTicket(c *gin.Context) {
	userId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的工单ID",
		})
		return
	}

	if err := model.CloseTicket(ticketId, userId); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "工单已关闭",
	})
}

// ReopenTicket reopens a closed ticket
func ReopenTicket(c *gin.Context) {
	userId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的工单ID",
		})
		return
	}

	if err := model.ReopenTicket(ticketId, userId); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "工单已重新开启",
	})
}

// ============================================================================
// Admin ticket endpoints
// ============================================================================

// GetAllTicketsAdmin lists all tickets (admin)
func GetAllTicketsAdmin(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status := c.Query("status")
	category := c.Query("category")
	keyword := c.Query("keyword")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	tickets, total, err := model.GetAllTickets(page, pageSize, status, category, keyword)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to get all tickets: %v", err))
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取工单列表失败",
		})
		return
	}

	var ticketResponses []dto.TicketResponse
	for _, ticket := range tickets {
		ticketResponses = append(ticketResponses, dto.TicketResponse{
			Id:         ticket.Id,
			UserId:     ticket.UserId,
			Title:      ticket.Title,
			Content:    ticket.Content,
			Category:   ticket.Category,
			Status:     ticket.Status,
			Priority:   ticket.Priority,
			AssignedTo: ticket.AssignedTo,
			ClosedAt:   ticket.ClosedAt,
			CreatedAt:  ticket.CreatedAt,
			UpdatedAt:  ticket.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": dto.TicketListData{
			Tickets: ticketResponses,
			Total:   total,
			Page:    page,
			Size:    pageSize,
		},
	})
}

// GetTicketAdmin gets ticket details with all messages (including internal)
func GetTicketAdmin(c *gin.Context) {
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的工单ID",
		})
		return
	}

	ticket, err := model.GetTicketByIdAdmin(ticketId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "工单不存在",
		})
		return
	}

	// Get messages including internal
	messages, err := model.GetTicketMessages(ticketId, true)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to get ticket messages: %v", err))
	}

	var msgDTOs []dto.TicketMessageDTO
	for _, msg := range messages {
		userName := ""
		user, err := model.GetUserById(msg.UserId, false)
		if err == nil {
			userName = user.DisplayName
			if userName == "" {
				userName = user.Username
			}
		}
		msgDTOs = append(msgDTOs, dto.TicketMessageDTO{
			Id:         msg.Id,
			UserId:     msg.UserId,
			Content:    msg.Content,
			IsInternal: msg.IsInternal,
			CreatedAt:  msg.CreatedAt,
			UserName:   userName,
		})
	}
	if msgDTOs == nil {
		msgDTOs = []dto.TicketMessageDTO{}
	}

	// Get user name
	userName := ""
	user, err := model.GetUserById(ticket.UserId, false)
	if err == nil {
		userName = user.DisplayName
		if userName == "" {
			userName = user.Username
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": dto.TicketResponse{
			Id:         ticket.Id,
			UserId:     ticket.UserId,
			Title:      ticket.Title,
			Content:    ticket.Content,
			Category:   ticket.Category,
			Status:     ticket.Status,
			Priority:   ticket.Priority,
			AssignedTo: ticket.AssignedTo,
			ClosedAt:   ticket.ClosedAt,
			CreatedAt:  ticket.CreatedAt,
			UpdatedAt:  ticket.UpdatedAt,
			Messages:   msgDTOs,
			UserName:   userName,
		},
	})
}

// AddTicketMessageAdmin adds a message (optionally internal) to a ticket
func AddTicketMessageAdmin(c *gin.Context) {
	adminId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的工单ID",
		})
		return
	}

	var req dto.AddTicketMessageAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	if req.Content == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "内容不能为空",
		})
		return
	}

	// Verify ticket exists
	_, err = model.GetTicketByIdAdmin(ticketId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "工单不存在",
		})
		return
	}

	msg := &model.TicketMessage{
		TicketId:   ticketId,
		UserId:     adminId,
		Content:    req.Content,
		IsInternal: req.IsInternal,
	}

	if err := model.AddTicketMessageAdmin(msg); err != nil {
		common.SysError(fmt.Sprintf("failed to add admin ticket message: %v", err))
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "回复失败",
		})
		return
	}

	// If it's a public reply, update ticket status to waiting_for_user
	if !req.IsInternal {
		if err := model.UpdateTicketStatus(ticketId, model.TicketStatusWaitingUser); err != nil {
			common.SysError(fmt.Sprintf("failed to update ticket status: %v", err))
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "回复成功",
	})
}

// UpdateTicketStatusAdmin updates ticket status
func UpdateTicketStatusAdmin(c *gin.Context) {
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的工单ID",
		})
		return
	}

	var req dto.UpdateTicketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	// Validate status
	valid := false
	for _, s := range model.ValidTicketStatuses {
		if s == req.Status {
			valid = true
			break
		}
	}
	if !valid {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的状态值",
		})
		return
	}

	if err := model.UpdateTicketStatus(ticketId, req.Status); err != nil {
		common.SysError(fmt.Sprintf("failed to update ticket status: %v", err))
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "更新状态失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "状态已更新",
	})
}

// AssignTicketAdmin assigns a ticket to an admin
func AssignTicketAdmin(c *gin.Context) {
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的工单ID",
		})
		return
	}

	var req dto.AssignTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	if err := model.AssignTicket(ticketId, req.AdminId); err != nil {
		common.SysError(fmt.Sprintf("failed to assign ticket: %v", err))
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "分配失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "分配成功",
	})
}
