package model

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	ErrTicketClosed        = errors.New("ticket is closed")
	ErrTicketStatusInvalid = errors.New("ticket status is invalid")
)

type Ticket struct {
	ID        int            `json:"id" gorm:"primaryKey"`
	UserID    int            `json:"user_id" gorm:"index"`
	Title     string         `json:"title" gorm:"type:varchar(100)"`
	Category  string         `json:"category" gorm:"type:varchar(32);index"`
	Priority  string         `json:"priority" gorm:"type:varchar(16);index"`
	Status    string         `json:"status" gorm:"type:varchar(16);index"`
	ModelID   string         `json:"model_id" gorm:"type:varchar(128)"`
	RequestID string         `json:"request_id" gorm:"type:varchar(128)"`
	CreatedAt int64          `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt int64          `json:"updated_at" gorm:"autoUpdateTime;index"`
	ClosedAt  int64          `json:"closed_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

type TicketMessage struct {
	ID        int    `json:"id" gorm:"primaryKey"`
	TicketID  int    `json:"ticket_id" gorm:"index"`
	AuthorID  int    `json:"author_id" gorm:"index"`
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

func (Ticket) TableName() string           { return "tickets" }
func (TicketMessage) TableName() string    { return "ticket_messages" }
func (TicketAttachment) TableName() string { return "ticket_attachments" }

func ListUserTickets(userID int, keyword, status string, page, pageSize int) ([]Ticket, int64, error) {
	query := DB.Model(&Ticket{}).Where("user_id = ?", userID)
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR request_id LIKE ?", like, like)
	}
	if status = strings.TrimSpace(status); status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]Ticket, 0)
	err := query.Order("updated_at desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&items).Error
	return items, total, err
}

func GetUserTicket(userID, ticketID int) (*Ticket, error) {
	var ticket Ticket
	if err := DB.Where("id = ? AND user_id = ?", ticketID, userID).First(&ticket).Error; err != nil {
		return nil, err
	}
	return &ticket, nil
}

func CreateTicket(ticket *Ticket, content string, authorID int, attachments []TicketAttachment) (*TicketMessage, error) {
	if strings.TrimSpace(ticket.Title) == "" || strings.TrimSpace(content) == "" {
		return nil, errors.New("ticket title and content are required")
	}
	now := time.Now().Unix()
	ticket.Status = "open"
	ticket.CreatedAt = now
	ticket.UpdatedAt = now
	message := &TicketMessage{AuthorID: authorID, Content: content, CreatedAt: now}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		message.TicketID = ticket.ID
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		for index := range attachments {
			attachments[index].TicketID = ticket.ID
			attachments[index].MessageID = message.ID
			attachments[index].CreatedAt = now
		}
		if len(attachments) > 0 {
			return tx.Create(&attachments).Error
		}
		return nil
	})
	return message, err
}

func ListTicketMessages(ticketID int) ([]TicketMessage, error) {
	items := make([]TicketMessage, 0)
	err := DB.Where("ticket_id = ?", ticketID).Order("created_at asc").Find(&items).Error
	return items, err
}

func AddTicketMessage(ticketID, authorID int, content string, attachments []TicketAttachment) (*TicketMessage, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, errors.New("ticket message is required")
	}
	now := time.Now().Unix()
	message := &TicketMessage{TicketID: ticketID, AuthorID: authorID, Content: content, CreatedAt: now}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var ticket Ticket
		if err := lockForUpdate(tx).
			Select("id", "status").
			Where("id = ? AND user_id = ?", ticketID, authorID).
			First(&ticket).Error; err != nil {
			return err
		}
		if ticket.Status == "closed" {
			return ErrTicketClosed
		}
		if ticket.Status != "open" && ticket.Status != "replied" {
			return ErrTicketStatusInvalid
		}
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		for index := range attachments {
			attachments[index].TicketID = ticketID
			attachments[index].MessageID = message.ID
			attachments[index].CreatedAt = now
		}
		if len(attachments) > 0 {
			if err := tx.Create(&attachments).Error; err != nil {
				return err
			}
		}
		return tx.Model(&ticket).Update("updated_at", now).Error
	})
	return message, err
}

func ListTicketAttachments(ticketID int) ([]TicketAttachment, error) {
	items := make([]TicketAttachment, 0)
	err := DB.Where("ticket_id = ?", ticketID).Order("id asc").Find(&items).Error
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

func UpdateTicketStatus(ticketID, userID int, status string) (*Ticket, error) {
	status = strings.TrimSpace(status)
	if status != "open" && status != "closed" {
		return nil, errors.New("invalid ticket status")
	}
	var ticket Ticket
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", ticketID, userID).First(&ticket).Error; err != nil {
			return err
		}
		now := time.Now().Unix()
		updates := map[string]any{"status": status, "updated_at": now}
		if status == "closed" {
			updates["closed_at"] = now
		} else {
			updates["closed_at"] = 0
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
