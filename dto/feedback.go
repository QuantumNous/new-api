package dto

import "time"

// 用户工单（建议及咨询）请求/响应 DTO。设计文档：docs/feedback-consult-design.md

// ─── 请求 ─────────────────────────────────────────────────────────────────────

// FeedbackCreateTopicRequest 新建工单。Images 为压缩后的纯 base64（无 data: 前缀）。
type FeedbackCreateTopicRequest struct {
	Category int      `json:"category"`
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Images   []string `json:"images"`
}

// FeedbackReplyRequest 回复工单。
type FeedbackReplyRequest struct {
	Content string   `json:"content"`
	Images  []string `json:"images"`
}

// FeedbackStatusRequest 管理员变更状态（仅允许 处理中 / 已关闭）。
type FeedbackStatusRequest struct {
	Status int `json:"status"`
}

// ─── 响应 ─────────────────────────────────────────────────────────────────────

// FeedbackTopicItem 工单列表项 / 详情头。管理员视角附 username 与 admin_unread。
type FeedbackTopicItem struct {
	Id            int       `json:"id"`
	UserId        int       `json:"user_id"`
	Username      string    `json:"username,omitempty"`
	Category      int       `json:"category"`
	Title         string    `json:"title"`
	Status        int       `json:"status"`
	MessageCount  int       `json:"message_count"`
	LastReplyAt   time.Time `json:"last_reply_at"`
	LastReplyRole int       `json:"last_reply_role"`
	UserUnread    bool      `json:"user_unread"`
	AdminUnread   bool      `json:"admin_unread"`
	CreatedAt     time.Time `json:"created_at"`
}

// FeedbackMessageItem 对话消息项。AuthorId/AuthorName 标识发言者（可区分具体管理员）。
type FeedbackMessageItem struct {
	Id         int       `json:"id"`
	AuthorId   int       `json:"author_id"`
	AuthorRole int       `json:"author_role"`
	AuthorName string    `json:"author_name"`
	Content    string    `json:"content"`
	ImageIds   []int     `json:"image_ids"`
	CreatedAt  time.Time `json:"created_at"`
}

// FeedbackTopicDetailResponse 工单详情：头信息 + 消息分页。
type FeedbackTopicDetailResponse struct {
	Topic    FeedbackTopicItem     `json:"topic"`
	Messages []FeedbackMessageItem `json:"messages"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
}

// FeedbackUnreadResponse 用户未读计数 + 是否有过工单（前端据此决定是否挂轮询）。
type FeedbackUnreadResponse struct {
	Unread    int64 `json:"unread"`
	HasTopics bool  `json:"has_topics"`
}
