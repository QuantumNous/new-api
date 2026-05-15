package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type playgroundConversationUpsertRequest struct {
	ConversationID string          `json:"conversation_id"`
	Title          string          `json:"title"`
	Messages       model.JSONValue `json:"messages"`
	CreatedAt      int64           `json:"created_at"`
	UpdatedAt      int64           `json:"updated_at"`
}

func GetUserPlaygroundConversations(c *gin.Context) {
	userID := c.GetInt("id")
	conversations, err := model.ListUserPlaygroundConversations(userID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, conversations)
}

func UpsertUserPlaygroundConversation(c *gin.Context) {
	userID := c.GetInt("id")
	var req playgroundConversationUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	req.ConversationID = strings.TrimSpace(req.ConversationID)
	req.Title = strings.TrimSpace(req.Title)
	if req.ConversationID == "" {
		common.ApiErrorMsg(c, "缺少会话 ID")
		return
	}

	conversation, err := model.UpsertUserPlaygroundConversation(
		userID,
		req.ConversationID,
		req.Title,
		req.Messages,
		req.CreatedAt,
		req.UpdatedAt,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, conversation)
}

func DeleteUserPlaygroundConversation(c *gin.Context) {
	userID := c.GetInt("id")
	conversationID := strings.TrimSpace(c.Param("conversation_id"))
	if conversationID == "" {
		common.ApiErrorMsg(c, "缺少会话 ID")
		return
	}
	if err := model.DeleteUserPlaygroundConversation(userID, conversationID); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, true)
}
