package controller

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	maxTicketAttachmentSize  = 10 * 1024 * 1024
	maxTicketAttachmentCount = 5
	maxTicketRequestSize     = maxTicketAttachmentCount*maxTicketAttachmentSize + 1024*1024
)

var ticketAttachmentExtensions = map[string]string{
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

type nextTicketDTO struct {
	ID            int    `json:"id"`
	Title         string `json:"title"`
	Category      string `json:"category"`
	Priority      string `json:"priority"`
	Status        string `json:"status"`
	ReplyCount    int    `json:"reply_count"`
	LastReplyRole string `json:"last_reply_role"`
	ModelID       string `json:"model_id,omitempty"`
	RequestID     string `json:"request_id,omitempty"`
	Created       int64  `json:"created"`
	Updated       int64  `json:"updated"`
}

type nextTicketMessageDTO struct {
	ID         int      `json:"id"`
	Role       string   `json:"role"`
	Department string   `json:"department,omitempty"`
	Content    string   `json:"content"`
	Images     []string `json:"images"`
	Created    int64    `json:"created"`
}

func nextTicketStorageDir() string {
	dir := strings.TrimSpace(os.Getenv("TICKET_UPLOAD_DIR"))
	if dir == "" {
		return filepath.Join("data", "ticket-attachments")
	}
	return dir
}

func nextTicketID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		nextBusinessError(c, "invalid ticket id", "VALIDATION_ERROR")
		return 0, false
	}
	return id, true
}

func nextBusinessError(c *gin.Context, message, code string) {
	common.ApiErrorWithCode(c, message, code)
}

func nextTicketNotFound(c *gin.Context) {
	nextBusinessError(c, "ticket not found", "NOT_FOUND")
}

func nextTicketRole(ticket *model.Ticket, message model.TicketMessage) string {
	if message.AuthorID == ticket.UserID {
		return "user"
	}
	return "support"
}

func buildNextTicketDTO(ticket *model.Ticket, messages []model.TicketMessage) nextTicketDTO {
	lastRole := "user"
	if len(messages) > 0 {
		lastRole = nextTicketRole(ticket, messages[len(messages)-1])
	}
	return nextTicketDTO{
		ID:            ticket.ID,
		Title:         ticket.Title,
		Category:      ticket.Category,
		Priority:      ticket.Priority,
		Status:        ticket.Status,
		ReplyCount:    len(messages),
		LastReplyRole: lastRole,
		ModelID:       ticket.ModelID,
		RequestID:     ticket.RequestID,
		Created:       ticket.CreatedAt,
		Updated:       ticket.UpdatedAt,
	}
}

func buildNextTicketMessages(ticket *model.Ticket, messages []model.TicketMessage, attachments []model.TicketAttachment) []nextTicketMessageDTO {
	imagesByMessage := make(map[int][]string)
	for _, attachment := range attachments {
		imagesByMessage[attachment.MessageID] = append(imagesByMessage[attachment.MessageID], fmt.Sprintf("/api/next/tickets/attachments/%d", attachment.ID))
	}
	items := make([]nextTicketMessageDTO, 0, len(messages))
	for _, message := range messages {
		role := nextTicketRole(ticket, message)
		item := nextTicketMessageDTO{
			ID:      message.ID,
			Role:    role,
			Content: message.Content,
			Images:  imagesByMessage[message.ID],
			Created: message.CreatedAt,
		}
		if item.Images == nil {
			item.Images = []string{}
		}
		if role == "support" {
			item.Department = "support"
		}
		items = append(items, item)
	}
	return items
}

func validateNextTicketFields(title, category, priority, content string) error {
	if title == "" || len([]rune(title)) > 100 {
		return errors.New("ticket title is required and must not exceed 100 characters")
	}
	if content == "" || len([]rune(content)) > 2000 {
		return errors.New("ticket content is required and must not exceed 2000 characters")
	}
	validCategory := category == "billing" || category == "api" || category == "model" || category == "account" || category == "other"
	validPriority := priority == "low" || priority == "normal" || priority == "high"
	if !validCategory || !validPriority {
		return errors.New("invalid ticket category or priority")
	}
	return nil
}

func saveNextTicketAttachments(headers []*multipart.FileHeader) ([]model.TicketAttachment, []string, error) {
	if len(headers) > maxTicketAttachmentCount {
		return nil, nil, fmt.Errorf("at most %d attachments are allowed", maxTicketAttachmentCount)
	}
	if len(headers) == 0 {
		return nil, nil, nil
	}
	dir := nextTicketStorageDir()
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, nil, err
	}
	attachments := make([]model.TicketAttachment, 0, len(headers))
	paths := make([]string, 0, len(headers))
	for _, header := range headers {
		if header.Size > maxTicketAttachmentSize {
			removeNextTicketFiles(paths)
			return nil, nil, fmt.Errorf("attachment %s exceeds 10 MB", filepath.Base(header.Filename))
		}
		file, err := header.Open()
		if err != nil {
			removeNextTicketFiles(paths)
			return nil, nil, err
		}
		content, readErr := io.ReadAll(io.LimitReader(file, maxTicketAttachmentSize+1))
		closeErr := file.Close()
		if readErr != nil || closeErr != nil {
			removeNextTicketFiles(paths)
			if readErr != nil {
				return nil, nil, readErr
			}
			return nil, nil, closeErr
		}
		if len(content) > maxTicketAttachmentSize {
			removeNextTicketFiles(paths)
			return nil, nil, fmt.Errorf("attachment %s exceeds 10 MB", filepath.Base(header.Filename))
		}
		mimeType := http.DetectContentType(content)
		extension, allowed := ticketAttachmentExtensions[mimeType]
		if !allowed {
			removeNextTicketFiles(paths)
			return nil, nil, fmt.Errorf("attachment %s has an unsupported image type", filepath.Base(header.Filename))
		}
		keyBytes := make([]byte, 24)
		if _, err := rand.Read(keyBytes); err != nil {
			removeNextTicketFiles(paths)
			return nil, nil, err
		}
		storageKey := hex.EncodeToString(keyBytes) + extension
		path := filepath.Join(dir, storageKey)
		if err := os.WriteFile(path, content, 0600); err != nil {
			removeNextTicketFiles(paths)
			return nil, nil, err
		}
		digest := sha256.Sum256(content)
		paths = append(paths, path)
		attachments = append(attachments, model.TicketAttachment{
			StorageKey:   storageKey,
			OriginalName: filepath.Base(header.Filename),
			MimeType:     mimeType,
			Size:         int64(len(content)),
			SHA256:       hex.EncodeToString(digest[:]),
		})
	}
	return attachments, paths, nil
}

func removeNextTicketFiles(paths []string) {
	for _, path := range paths {
		_ = os.Remove(path)
	}
}

func NextListTickets(c *gin.Context) {
	page := 1
	pageSize := 10
	if value, err := strconv.Atoi(c.Query("page")); err == nil && value > 0 {
		page = value
	}
	if value, err := strconv.Atoi(c.Query("page_size")); err == nil && value > 0 && value <= 100 {
		pageSize = value
	}
	tickets, total, err := model.ListUserTickets(c.GetInt("id"), c.Query("keyword"), c.Query("status"), page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]nextTicketDTO, 0, len(tickets))
	for index := range tickets {
		messages, err := model.ListTicketMessages(tickets[index].ID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		items = append(items, buildNextTicketDTO(&tickets[index], messages))
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total, "page": page, "page_size": pageSize})
}

func NextCreateTicket(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxTicketRequestSize)
	form, err := c.MultipartForm()
	if err != nil {
		nextBusinessError(c, "invalid multipart request", "VALIDATION_ERROR")
		return
	}
	defer form.RemoveAll()
	title := strings.TrimSpace(c.PostForm("title"))
	category := strings.TrimSpace(c.PostForm("category"))
	priority := strings.TrimSpace(c.PostForm("priority"))
	content := strings.TrimSpace(c.PostForm("content"))
	if err := validateNextTicketFields(title, category, priority, content); err != nil {
		nextBusinessError(c, err.Error(), "VALIDATION_ERROR")
		return
	}
	attachments, paths, err := saveNextTicketAttachments(form.File["attachments"])
	if err != nil {
		nextBusinessError(c, err.Error(), "VALIDATION_ERROR")
		return
	}
	userID := c.GetInt("id")
	ticket := &model.Ticket{
		UserID:    userID,
		Title:     title,
		Category:  category,
		Priority:  priority,
		ModelID:   strings.TrimSpace(c.PostForm("model_id")),
		RequestID: strings.TrimSpace(c.PostForm("request_id")),
	}
	if _, err := model.CreateTicket(ticket, content, userID, attachments); err != nil {
		removeNextTicketFiles(paths)
		common.ApiError(c, err)
		return
	}
	messages, err := model.ListTicketMessages(ticket.ID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ticket": buildNextTicketDTO(ticket, messages)})
}

func NextGetTicket(c *gin.Context) {
	ticketID, ok := nextTicketID(c)
	if !ok {
		return
	}
	ticket, err := model.GetUserTicket(c.GetInt("id"), ticketID)
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
	common.ApiSuccess(c, gin.H{
		"ticket":   buildNextTicketDTO(ticket, messages),
		"messages": buildNextTicketMessages(ticket, messages, attachments),
	})
}

func NextAddTicketMessage(c *gin.Context) {
	ticketID, ok := nextTicketID(c)
	if !ok {
		return
	}
	userID := c.GetInt("id")
	ticket, err := model.GetUserTicket(userID, ticketID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		nextTicketNotFound(c)
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ticket.Status == "closed" {
		nextBusinessError(c, "closed tickets cannot receive replies", "TICKET_CLOSED")
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
	message, err := model.AddTicketMessage(ticketID, userID, content, attachments)
	if errors.Is(err, model.ErrTicketClosed) {
		removeNextTicketFiles(paths)
		nextBusinessError(c, "closed tickets cannot receive replies", "TICKET_CLOSED")
		return
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		removeNextTicketFiles(paths)
		nextTicketNotFound(c)
		return
	}
	if err != nil {
		removeNextTicketFiles(paths)
		common.ApiError(c, err)
		return
	}
	storedAttachments, err := model.ListTicketAttachments(ticketID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := buildNextTicketMessages(ticket, []model.TicketMessage{*message}, storedAttachments)
	common.ApiSuccess(c, gin.H{"message": items[0]})
}

func NextUpdateTicketStatus(c *gin.Context) {
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
	ticket, err := model.UpdateTicketStatus(ticketID, c.GetInt("id"), request.Status)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		nextTicketNotFound(c)
		return
	}
	if err != nil {
		nextBusinessError(c, err.Error(), "VALIDATION_ERROR")
		return
	}
	messages, err := model.ListTicketMessages(ticket.ID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ticket": buildNextTicketDTO(ticket, messages)})
}

func NextDownloadTicketAttachment(c *gin.Context) {
	attachmentID, err := strconv.Atoi(c.Param("attachment_id"))
	if err != nil || attachmentID <= 0 {
		nextBusinessError(c, "invalid attachment id", "VALIDATION_ERROR")
		return
	}
	attachment, err := model.GetUserTicketAttachment(c.GetInt("id"), attachmentID)
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
