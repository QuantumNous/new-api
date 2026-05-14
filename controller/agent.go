package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/agent"
	"github.com/QuantumNous/new-api/setting/agent_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetAgentConfig(c *gin.Context) {
	setting := agent_setting.GetAgentSetting()
	common.ApiSuccess(c, dto.AgentConfigResponse{
		Enabled:     setting.Enabled,
		DisplayName: setting.DisplayName,
		QuickActions: []string{
			"Check my balance",
			"List my API keys",
			"Show recent failed requests",
			"Which model should I use?",
		},
	})
}

func AgentChat(c *gin.Context) {
	var req dto.AgentChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	events, err := agent.NewOrchestrator().RunStream(c.Request.Context(), userId, req.SessionId, req.Message, agent.RunOptions{Stream: true})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	writeAgentSSE(c, events)
}

func AgentConfirm(c *gin.Context) {
	var req dto.AgentConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	events, err := agent.NewOrchestrator().Confirm(c.Request.Context(), userId, req.SessionId, req.ConfirmToken, req.Accept)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	writeAgentSSE(c, events)
}

func ListAgentSessions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	sessions, err := agent.ListSessions(c.Request.Context(), c.GetInt("id"), limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rows := make([]dto.AgentSessionResponse, 0, len(sessions))
	for _, session := range sessions {
		rows = append(rows, dto.AgentSessionResponse{
			Id:          session.Id,
			Title:       session.Title,
			LastMessage: session.LastMessage,
			Status:      session.Status,
			TokenCost:   session.TokenCost,
			CreatedAt:   session.CreatedAt.Unix(),
			UpdatedAt:   session.UpdatedAt.Unix(),
		})
	}
	common.ApiSuccess(c, rows)
}

func GetAgentSession(c *gin.Context) {
	sessionId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	session, err := agent.GetSessionMessages(c.Request.Context(), c.GetInt("id"), sessionId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, session)
}

func DeleteAgentSession(c *gin.Context) {
	sessionId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := agent.DeleteSession(c.Request.Context(), c.GetInt("id"), sessionId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"deleted": true})
}

func ListAgentTools(c *gin.Context) {
	common.ApiSuccess(c, agent.NewRegistry().ListTools())
}

func AdminListAgentTools(c *gin.Context) {
	tools := agent.NewRegistry().ListTools()
	var settings []model.AgentToolSetting
	_ = model.DB.WithContext(c.Request.Context()).Find(&settings).Error
	enabledMap := map[string]bool{}
	for _, setting := range settings {
		enabledMap[setting.ToolName] = setting.Enabled
	}
	rows := make([]gin.H, 0, len(tools))
	for _, tool := range tools {
		enabled, ok := enabledMap[tool.Name]
		if !ok {
			enabled = true
		}
		rows = append(rows, gin.H{"tool": tool, "enabled": enabled})
	}
	common.ApiSuccess(c, rows)
}

func AdminUpdateAgentTool(c *gin.Context) {
	toolName := strings.TrimSpace(c.Param("name"))
	if toolName == "" {
		common.ApiErrorMsg(c, "tool name is required")
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	setting := model.AgentToolSetting{ToolName: toolName, Enabled: req.Enabled}
	if err := model.DB.WithContext(c.Request.Context()).Save(&setting).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, setting)
}

func AdminListAgentAudit(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	var logs []model.AgentAuditLog
	tx := model.DB.WithContext(c.Request.Context()).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx())
	if userId, err := strconv.Atoi(c.Query("user_id")); err == nil && userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	if tool := strings.TrimSpace(c.Query("tool")); tool != "" {
		tx = tx.Where("tool_name = ?", tool)
	}
	if err := tx.Find(&logs).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var total int64
	_ = model.DB.WithContext(c.Request.Context()).Model(&model.AgentAuditLog{}).Count(&total).Error
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetAgentSettings(c *gin.Context) {
	common.ApiSuccess(c, agent_setting.GetAgentSetting())
}

func AdminListAgentKBDocs(c *gin.Context) {
	var docs []model.AgentKBDoc
	if err := model.DB.WithContext(c.Request.Context()).Order("id desc").Limit(100).Find(&docs).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, docs)
}

func AdminCreateAgentKBDoc(c *gin.Context) {
	var req struct {
		Title   string `json:"title" binding:"required"`
		Source  string `json:"source"`
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	doc := model.AgentKBDoc{Title: strings.TrimSpace(req.Title), Source: strings.TrimSpace(req.Source), Status: "ready"}
	if doc.Title == "" || strings.TrimSpace(req.Content) == "" {
		common.ApiErrorMsg(c, "title and content are required")
		return
	}
	err := model.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&doc).Error; err != nil {
			return err
		}
		chunks := splitAgentKBContent(req.Content, 1200)
		for _, chunk := range chunks {
			if err := tx.Create(&model.AgentKBChunk{DocId: doc.Id, Content: chunk, TokenCount: len([]rune(chunk)) / 2}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&doc).Update("chunks_count", len(chunks)).Error
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, doc)
}

func AdminDeleteAgentKBDoc(c *gin.Context) {
	docId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	err = model.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("doc_id = ?", docId).Delete(&model.AgentKBChunk{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.AgentKBDoc{}, docId).Error
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"deleted": true})
}

func SearchAgentKnowledge(c *gin.Context) {
	query := c.Query("query")
	results, err := agent.SearchKnowledge(c.Request.Context(), query)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, results)
}

func writeAgentSSE(c *gin.Context, events <-chan dto.AgentEvent) {
	c.Status(http.StatusOK)
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	sentDone := false
	for event := range events {
		payload, _ := json.Marshal(event)
		fmt.Fprintf(c.Writer, "event: %s\n", event.Type)
		fmt.Fprintf(c.Writer, "data: %s\n\n", payload)
		c.Writer.Flush()
		if event.Type == constant.AgentEventDone {
			sentDone = true
			break
		}
	}
	if !sentDone {
		fmt.Fprintf(c.Writer, "event: done\ndata: {\"type\":\"done\",\"done\":true}\n\n")
		c.Writer.Flush()
	}
}

func splitAgentKBContent(content string, maxRunes int) []string {
	content = strings.TrimSpace(content)
	if maxRunes <= 0 || len([]rune(content)) <= maxRunes {
		return []string{content}
	}
	runes := []rune(content)
	chunks := make([]string, 0, len(runes)/maxRunes+1)
	for start := 0; start < len(runes); start += maxRunes {
		end := start + maxRunes
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, strings.TrimSpace(string(runes[start:end])))
	}
	return chunks
}
