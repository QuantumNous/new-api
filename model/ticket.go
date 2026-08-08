package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

// Ticket status constants
const (
	TicketStatusOpen         = "open"
	TicketStatusInProgress   = "in_progress"
	TicketStatusWaitingUser  = "waiting_for_user"
	TicketStatusResolved     = "resolved"
	TicketStatusClosed       = "closed"
)

// Ticket priority constants
const (
	TicketPriorityLow    = "low"
	TicketPriorityMedium = "medium"
	TicketPriorityHigh   = "high"
	TicketPriorityUrgent = "urgent"
)

// Ticket category constants
const (
	TicketCategoryTechnical     = "technical"
	TicketCategoryBilling       = "billing"
	TicketCategoryAccount       = "account"
	TicketCategoryGeneral       = "general"
	TicketCategoryFeatureRequest = "feature_request"
)

var ValidTicketStatuses = []string{
	TicketStatusOpen, TicketStatusInProgress,
	TicketStatusWaitingUser, TicketStatusResolved, TicketStatusClosed,
}

var ValidTicketPriorities = []string{
	TicketPriorityLow, TicketPriorityMedium, TicketPriorityHigh, TicketPriorityUrgent,
}

var ValidTicketCategories = []string{
	TicketCategoryTechnical, TicketCategoryBilling,
	TicketCategoryAccount, TicketCategoryGeneral, TicketCategoryFeatureRequest,
}

type Ticket struct {
	Id         int            `json:"id"`
	UserId     int            `json:"user_id" gorm:"index;not null"`
	Title      string         `json:"title" gorm:"type:varchar(255);not null"`
	Content    string         `json:"content" gorm:"type:text;not null"`
	Category   string         `json:"category" gorm:"type:varchar(50);default:'general'"`
	Status     string         `json:"status" gorm:"type:varchar(20);default:'open'"`
	Priority   string         `json:"priority" gorm:"type:varchar(20);default:'medium'"`
	AssignedTo *int           `json:"assigned_to" gorm:"index"`
	ClosedAt   *int64         `json:"closed_at"`
	CreatedAt  int64          `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  int64          `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

type TicketMessage struct {
	Id         int    `json:"id"`
	TicketId   int    `json:"ticket_id" gorm:"index;not null"`
	UserId     int    `json:"user_id" gorm:"not null"`
	Content    string `json:"content" gorm:"type:text;not null"`
	IsInternal bool   `json:"is_internal" gorm:"default:false"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime"`
}

// ============================================================================
// User-facing ticket operations
// ============================================================================

func GetUserTickets(userId int, page, pageSize int, status string) ([]Ticket, int64, error) {
	var tickets []Ticket
	var total int64
	query := DB.Where("user_id = ?", userId)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Model(&Ticket{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&tickets).Error; err != nil {
		return nil, 0, err
	}
	return tickets, total, nil
}

func GetTicketById(ticketId, userId int) (*Ticket, error) {
	var ticket Ticket
	err := DB.Where("id = ? AND user_id = ?", ticketId, userId).First(&ticket).Error
	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

func CreateTicket(ticket *Ticket) error {
	return DB.Create(ticket).Error
}

func AddTicketMessage(msg *TicketMessage) error {
	// Update ticket's updated_at time and status if user adds message
	tx := DB.Begin()
	if err := tx.Create(msg).Error; err != nil {
		tx.Rollback()
		return err
	}
	// If the ticket was in "waiting_for_user" status, set it back to "open"
	if err := tx.Model(&Ticket{}).Where("id = ? AND status = ?", msg.TicketId, TicketStatusWaitingUser).
		Update("status", TicketStatusOpen).Error; err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit().Error
}

func GetTicketMessages(ticketId int, includeInternal bool) ([]TicketMessage, error) {
	var messages []TicketMessage
	query := DB.Where("ticket_id = ?", ticketId)
	if !includeInternal {
		query = query.Where("is_internal = false")
	}
	if err := query.Order("id ASC").Find(&messages).Error; err != nil {
		return nil, err
	}
	return messages, nil
}

func CloseTicket(ticketId, userId int) error {
	now := time.Now().Unix()
	result := DB.Model(&Ticket{}).Where("id = ? AND user_id = ? AND status NOT IN ?",
		ticketId, userId, []string{TicketStatusClosed, TicketStatusResolved}).
		Updates(map[string]interface{}{
			"status":    TicketStatusClosed,
			"closed_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("ticket not found or already closed")
	}
	return nil
}

func ReopenTicket(ticketId, userId int) error {
	result := DB.Model(&Ticket{}).Where("id = ? AND user_id = ? AND status IN ?",
		ticketId, userId, []string{TicketStatusClosed, TicketStatusResolved}).
		Updates(map[string]interface{}{
			"status":    TicketStatusOpen,
			"closed_at": nil,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("ticket not found or cannot be reopened")
	}
	return nil
}

// ============================================================================
// Admin ticket operations
// ============================================================================

func GetAllTickets(page, pageSize int, status, category, keyword string) ([]Ticket, int64, error) {
	var tickets []Ticket
	var total int64
	query := DB.Model(&Ticket{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if keyword != "" {
		query = query.Where("title LIKE ? OR content LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("CASE WHEN status = 'open' THEN 0 WHEN status = 'in_progress' THEN 1 WHEN status = 'waiting_for_user' THEN 2 ELSE 3 END").
		Order("updated_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&tickets).Error; err != nil {
		return nil, 0, err
	}
	return tickets, total, nil
}

func GetTicketByIdAdmin(ticketId int) (*Ticket, error) {
	var ticket Ticket
	err := DB.First(&ticket, ticketId).Error
	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

func UpdateTicketStatus(ticketId int, status string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if status == TicketStatusClosed || status == TicketStatusResolved {
		now := time.Now().Unix()
		updates["closed_at"] = now
	}
	if status == TicketStatusOpen {
		updates["closed_at"] = nil
	}
	return DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(updates).Error
}

func AssignTicket(ticketId, adminId int) error {
	return DB.Model(&Ticket{}).Where("id = ?", ticketId).
		Updates(map[string]interface{}{
			"assigned_to": adminId,
		}).Error
}

func AddTicketMessageAdmin(msg *TicketMessage) error {
	return DB.Create(msg).Error
}

func DeleteTicket(ticketId int) error {
	return DB.Delete(&Ticket{}, ticketId).Error
}
