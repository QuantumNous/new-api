package dto

// ============================================================================
// Request DTOs
// ============================================================================

type CreateTicketRequest struct {
	Title    string `json:"title" binding:"required,max=255"`
	Content  string `json:"content" binding:"required"`
	Category string `json:"category"`
	Priority string `json:"priority"`
}

type AddTicketMessageRequest struct {
	Content string `json:"content" binding:"required"`
}

type AddTicketMessageAdminRequest struct {
	Content    string `json:"content" binding:"required"`
	IsInternal bool   `json:"is_internal"`
}

type UpdateTicketStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type AssignTicketRequest struct {
	AdminId int `json:"admin_id" binding:"required"`
}

type TicketListQuery struct {
	Page     int    `form:"page" json:"page"`
	PageSize int    `form:"page_size" json:"page_size"`
	Status   string `form:"status" json:"status"`
	Category string `form:"category" json:"category"`
	Keyword  string `form:"keyword" json:"keyword"`
}

// ============================================================================
// Response DTOs
// ============================================================================

type TicketResponse struct {
	Id         int               `json:"id"`
	UserId     int               `json:"user_id"`
	Title      string            `json:"title"`
	Content    string            `json:"content"`
	Category   string            `json:"category"`
	Status     string            `json:"status"`
	Priority   string            `json:"priority"`
	AssignedTo *int              `json:"assigned_to"`
	ClosedAt   *int64            `json:"closed_at"`
	CreatedAt  int64             `json:"created_at"`
	UpdatedAt  int64             `json:"updated_at"`
	Messages   []TicketMessageDTO `json:"messages,omitempty"`
	UserName   string            `json:"user_name,omitempty"`
}

type TicketMessageDTO struct {
	Id         int    `json:"id"`
	UserId     int    `json:"user_id"`
	Content    string `json:"content"`
	IsInternal bool   `json:"is_internal"`
	CreatedAt  int64  `json:"created_at"`
	UserName   string `json:"user_name,omitempty"`
}

type TicketListResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message,omitempty"`
	Data    *TicketListData   `json:"data,omitempty"`
}

type TicketListData struct {
	Tickets []TicketResponse `json:"tickets"`
	Total   int64            `json:"total"`
	Page    int              `json:"page"`
	Size    int              `json:"size"`
}
