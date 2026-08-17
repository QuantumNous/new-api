package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	TicketStatusOpen    = "open"
	TicketStatusReplied = "replied"
	TicketStatusClosed  = "closed"

	TicketMessageRoleUser    = "user"
	TicketMessageRoleSupport = "support"
)

var (
	ErrTicketClosed        = errors.New("ticket is closed")
	ErrTicketStatusInvalid = errors.New("ticket status is invalid")
	ErrTicketRoleInvalid   = errors.New("ticket message role is invalid")
)

type Ticket struct {
	ID         int            `json:"id" gorm:"primaryKey"`
	UserID     int            `json:"user_id" gorm:"index;index:idx_tickets_user_status_updated,priority:1"`
	AssigneeID *int           `json:"assignee_id" gorm:"index;index:idx_tickets_status_assignee_updated,priority:2"`
	AssignedAt int64          `json:"assigned_at"`
	Title      string         `json:"title" gorm:"type:varchar(100)"`
	Category   string         `json:"category" gorm:"type:varchar(32);index"`
	Priority   string         `json:"priority" gorm:"type:varchar(16);index"`
	Status     string         `json:"status" gorm:"type:varchar(16);index;index:idx_tickets_user_status_updated,priority:2;index:idx_tickets_status_assignee_updated,priority:1"`
	ModelID    string         `json:"model_id" gorm:"type:varchar(128)"`
	RequestID  string         `json:"request_id" gorm:"type:varchar(128)"`
	CreatedAt  int64          `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt  int64          `json:"updated_at" gorm:"autoUpdateTime;index;index:idx_tickets_user_status_updated,priority:3,sort:desc;index:idx_tickets_status_assignee_updated,priority:3,sort:desc"`
	ClosedAt   int64          `json:"closed_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
}

type TicketMessage struct {
	ID        int    `json:"id" gorm:"primaryKey"`
	TicketID  int    `json:"ticket_id" gorm:"index"`
	AuthorID  int    `json:"author_id" gorm:"index"`
	Role      string `json:"role" gorm:"type:varchar(16);not null;default:user;index"`
	Content   string `json:"content" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

type TicketAttachment struct {
	ID           int    `json:"id" gorm:"primaryKey"`
	TicketID     int    `json:"ticket_id" gorm:"index"`
	MessageID    int    `json:"message_id" gorm:"index"`
	StorageKey   string `json:"storage_key" gorm:"type:varchar(255);uniqueIndex"`
	OriginalName string `json:"original_name" gorm:"type:varchar(255)"`
	MimeType     string `json:"mime_type" gorm:"type:varchar(100)"`
	Size         int64  `json:"size"`
	SHA256       string `json:"sha256" gorm:"type:char(64)"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime"`
}

type TicketSummary struct {
	Ticket
	MessageCount    int    `json:"message_count" gorm:"column:message_count"`
	LastReplyRole   string `json:"last_reply_role" gorm:"column:last_reply_role"`
	UserName        string `json:"user_name" gorm:"column:user_name"`
	UserDisplayName string `json:"user_display_name" gorm:"column:user_display_name"`
	AssigneeName    string `json:"assignee_name" gorm:"column:assignee_name"`
}

type AdminTicketFilter struct {
	Keyword    string
	Status     string
	Category   string
	Priority   string
	AssigneeID *int
	Page       int
	PageSize   int
}

type TicketQueueSummary struct {
	Pending    int64 `json:"pending"`
	Unassigned int64 `json:"unassigned"`
	Mine       int64 `json:"mine"`
}

func (Ticket) TableName() string           { return "tickets" }
func (TicketMessage) TableName() string    { return "ticket_messages" }
func (TicketAttachment) TableName() string { return "ticket_attachments" }

func IsTicketStatus(value string) bool {
	return value == TicketStatusOpen || value == TicketStatusReplied || value == TicketStatusClosed
}

func ticketSummarySelect(includeUsers bool) string {
	columns := `t.*, ` +
		`(SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id) AS message_count, ` +
		`COALESCE((SELECT tm.role FROM ticket_messages tm WHERE tm.ticket_id = t.id ORDER BY tm.created_at DESC, tm.id DESC LIMIT 1), 'user') AS last_reply_role`
	if includeUsers {
		columns += `, u.username AS user_name, u.display_name AS user_display_name, a.username AS assignee_name`
	}
	return columns
}

func ListUserTickets(userID int, keyword, status string, page, pageSize int) ([]TicketSummary, int64, error) {
	query := DB.Table("tickets AS t").Where("t.deleted_at IS NULL AND t.user_id = ?", userID)
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(t.title LIKE ? OR t.request_id LIKE ?)", like, like)
	}
	if status = strings.TrimSpace(status); status != "" {
		query = query.Where("t.status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]TicketSummary, 0)
	err := query.Select(ticketSummarySelect(false)).
		Order("t.updated_at DESC, t.id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Scan(&items).Error
	return items, total, err
}

func ListAdminTickets(filter AdminTicketFilter) ([]TicketSummary, int64, error) {
	query := DB.Table("tickets AS t").
		Joins("JOIN users AS u ON u.id = t.user_id").
		Joins("LEFT JOIN users AS a ON a.id = t.assignee_id").
		Where("t.deleted_at IS NULL")
	if filter.Keyword = strings.TrimSpace(filter.Keyword); filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("(t.title LIKE ? OR t.request_id LIKE ? OR u.username LIKE ? OR u.display_name LIKE ?)", like, like, like, like)
	}
	if filter.Status != "" {
		query = query.Where("t.status = ?", filter.Status)
	}
	if filter.Category != "" {
		query = query.Where("t.category = ?", filter.Category)
	}
	if filter.Priority != "" {
		query = query.Where("t.priority = ?", filter.Priority)
	}
	if filter.AssigneeID != nil {
		if *filter.AssigneeID == 0 {
			query = query.Where("t.assignee_id IS NULL")
		} else {
			query = query.Where("t.assignee_id = ?", *filter.AssigneeID)
		}
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]TicketSummary, 0)
	err := query.Select(ticketSummarySelect(true)).
		Order("t.updated_at DESC, t.id DESC").
		Limit(filter.PageSize).
		Offset((filter.Page - 1) * filter.PageSize).
		Scan(&items).Error
	return items, total, err
}

func GetTicketQueueSummary(userID int) (TicketQueueSummary, error) {
	var summary TicketQueueSummary
	err := DB.Table("tickets").
		Select(
			"SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS pending, "+
				"SUM(CASE WHEN status = ? AND assignee_id IS NULL THEN 1 ELSE 0 END) AS unassigned, "+
				"SUM(CASE WHEN status <> ? AND assignee_id = ? THEN 1 ELSE 0 END) AS mine",
			TicketStatusOpen,
			TicketStatusOpen,
			TicketStatusClosed,
			userID,
		).
		Where("deleted_at IS NULL").
		Scan(&summary).Error
	return summary, err
}

func GetUserTicket(userID, ticketID int) (*Ticket, error) {
	var ticket Ticket
	if err := DB.Where("id = ? AND user_id = ?", ticketID, userID).First(&ticket).Error; err != nil {
		return nil, err
	}
	return &ticket, nil
}

func GetTicket(ticketID int) (*Ticket, error) {
	var ticket Ticket
	if err := DB.First(&ticket, ticketID).Error; err != nil {
		return nil, err
	}
	return &ticket, nil
}

func CreateTicket(ticket *Ticket, content string, authorID int, attachments []TicketAttachment) (*TicketMessage, error) {
	if strings.TrimSpace(ticket.Title) == "" || strings.TrimSpace(content) == "" {
		return nil, errors.New("ticket title and content are required")
	}
	now := time.Now().Unix()
	ticket.Status = TicketStatusOpen
	ticket.CreatedAt = now
	ticket.UpdatedAt = now
	message := &TicketMessage{AuthorID: authorID, Role: TicketMessageRoleUser, Content: content, CreatedAt: now}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		message.TicketID = ticket.ID
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		return createTicketAttachments(tx, ticket.ID, message.ID, now, attachments)
	})
	return message, err
}

func ListTicketMessages(ticketID int) ([]TicketMessage, error) {
	items := make([]TicketMessage, 0)
	err := DB.Where("ticket_id = ?", ticketID).Order("created_at ASC, id ASC").Find(&items).Error
	return items, err
}

func AddTicketMessage(ticketID, authorID int, content string, attachments []TicketAttachment) (*TicketMessage, *Ticket, error) {
	return addTicketMessage(ticketID, authorID, TicketMessageRoleUser, content, attachments, true)
}

func AddSupportTicketMessage(ticketID, authorID int, content string, attachments []TicketAttachment) (*TicketMessage, *Ticket, error) {
	return addTicketMessage(ticketID, authorID, TicketMessageRoleSupport, content, attachments, false)
}

func addTicketMessage(ticketID, authorID int, role, content string, attachments []TicketAttachment, requireOwner bool) (*TicketMessage, *Ticket, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, nil, errors.New("ticket message is required")
	}
	if role != TicketMessageRoleUser && role != TicketMessageRoleSupport {
		return nil, nil, ErrTicketRoleInvalid
	}
	now := time.Now().Unix()
	message := &TicketMessage{TicketID: ticketID, AuthorID: authorID, Role: role, Content: content, CreatedAt: now}
	var ticket Ticket
	err := DB.Transaction(func(tx *gorm.DB) error {
		query := lockForUpdate(tx).Where("id = ?", ticketID)
		if requireOwner {
			query = query.Where("user_id = ?", authorID)
		}
		if err := query.First(&ticket).Error; err != nil {
			return err
		}
		if ticket.Status == TicketStatusClosed {
			return ErrTicketClosed
		}
		if ticket.Status != TicketStatusOpen && ticket.Status != TicketStatusReplied {
			return ErrTicketStatusInvalid
		}
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		if err := createTicketAttachments(tx, ticketID, message.ID, now, attachments); err != nil {
			return err
		}
		updates := map[string]any{"updated_at": now}
		if role == TicketMessageRoleUser {
			updates["status"] = TicketStatusOpen
			ticket.Status = TicketStatusOpen
		} else {
			updates["status"] = TicketStatusReplied
			ticket.Status = TicketStatusReplied
			if ticket.AssigneeID == nil {
				assigneeID := authorID
				updates["assignee_id"] = assigneeID
				updates["assigned_at"] = now
				ticket.AssigneeID = &assigneeID
				ticket.AssignedAt = now
			}
		}
		if err := tx.Model(&ticket).Updates(updates).Error; err != nil {
			return err
		}
		ticket.UpdatedAt = now
		return nil
	})
	return message, &ticket, err
}

func createTicketAttachments(tx *gorm.DB, ticketID, messageID int, now int64, attachments []TicketAttachment) error {
	for index := range attachments {
		attachments[index].TicketID = ticketID
		attachments[index].MessageID = messageID
		attachments[index].CreatedAt = now
	}
	if len(attachments) == 0 {
		return nil
	}
	return tx.Create(&attachments).Error
}

func ListTicketAttachments(ticketID int) ([]TicketAttachment, error) {
	items := make([]TicketAttachment, 0)
	err := DB.Where("ticket_id = ?", ticketID).Order("id ASC").Find(&items).Error
	return items, err
}

func GetUserTicketAttachment(userID, attachmentID int) (*TicketAttachment, error) {
	var attachment TicketAttachment
	err := DB.Table("ticket_attachments AS a").
		Select("a.*").
		Joins("JOIN tickets AS t ON t.id = a.ticket_id AND t.deleted_at IS NULL").
		Where("a.id = ? AND t.user_id = ?", attachmentID, userID).
		First(&attachment).Error
	if err != nil {
		return nil, err
	}
	return &attachment, nil
}

func GetTicketAttachment(attachmentID int) (*TicketAttachment, error) {
	var attachment TicketAttachment
	err := DB.Table("ticket_attachments AS a").
		Select("a.*").
		Joins("JOIN tickets AS t ON t.id = a.ticket_id AND t.deleted_at IS NULL").
		Where("a.id = ?", attachmentID).
		First(&attachment).Error
	if err != nil {
		return nil, err
	}
	return &attachment, nil
}

func UpdateTicketStatus(ticketID, userID int, status string) (*Ticket, error) {
	return updateTicketStatus(ticketID, userID, status, true)
}

func UpdateAdminTicketStatus(ticketID, userID int, status string) (*Ticket, error) {
	return updateTicketStatus(ticketID, userID, status, false)
}

func updateTicketStatus(ticketID, userID int, status string, requireOwner bool) (*Ticket, error) {
	status = strings.TrimSpace(status)
	if status != TicketStatusOpen && status != TicketStatusClosed {
		return nil, errors.New("invalid ticket status")
	}
	var ticket Ticket
	err := DB.Transaction(func(tx *gorm.DB) error {
		query := lockForUpdate(tx).Where("id = ?", ticketID)
		if requireOwner {
			query = query.Where("user_id = ?", userID)
		}
		if err := query.First(&ticket).Error; err != nil {
			return err
		}
		now := time.Now().Unix()
		updates := map[string]any{"status": status, "updated_at": now}
		if status == TicketStatusClosed {
			updates["closed_at"] = now
			ticket.ClosedAt = now
		} else {
			updates["closed_at"] = 0
			ticket.ClosedAt = 0
		}
		if err := tx.Model(&ticket).Updates(updates).Error; err != nil {
			return err
		}
		ticket.Status = status
		ticket.UpdatedAt = now
		return nil
	})
	return &ticket, err
}

func AssignTicket(ticketID int, assigneeID *int) (*Ticket, error) {
	ticket, _, err := AssignTicketWithChange(ticketID, assigneeID)
	return ticket, err
}

func AssignTicketWithChange(ticketID int, assigneeID *int) (*Ticket, bool, error) {
	var ticket Ticket
	changed := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ?", ticketID).First(&ticket).Error; err != nil {
			return err
		}
		changed = !sameTicketAssignee(ticket.AssigneeID, assigneeID)
		if !changed {
			return nil
		}
		now := time.Now().Unix()
		updates := map[string]any{"assignee_id": nil, "assigned_at": 0, "updated_at": now}
		if assigneeID != nil {
			updates["assignee_id"] = *assigneeID
			updates["assigned_at"] = now
		}
		if err := tx.Model(&ticket).Updates(updates).Error; err != nil {
			return err
		}
		ticket.AssigneeID = assigneeID
		ticket.AssignedAt = 0
		if assigneeID != nil {
			ticket.AssignedAt = now
		}
		ticket.UpdatedAt = now
		return nil
	})
	return &ticket, changed, err
}

func sameTicketAssignee(current, next *int) bool {
	if current == nil || next == nil {
		return current == nil && next == nil
	}
	return *current == *next
}

func ListEnabledTicketAgents() ([]User, error) {
	items := make([]User, 0)
	err := DB.Select("id", "username", "display_name", "email", "setting", "role", "status").
		Where("status = ? AND role >= ?", common.UserStatusEnabled, common.RoleAdminUser).
		Order("role DESC, id ASC").
		Find(&items).Error
	return items, err
}

func BackfillTicketMessageRoles() error {
	return DB.Model(&TicketMessage{}).
		Where("role = '' OR role IS NULL").
		Update("role", TicketMessageRoleUser).Error
}
