package controller

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// 用户工单（建议及咨询）控制器。设计文档：docs/feedback-consult-design.md
//
// 权限模型：用户侧 handler 全部强制 user_id = c.GetInt("id")，越权一律 404
// （不泄露存在性）；管理员侧 handler 注册在 adminRoute（AdminAuth）下，可见全量。

const (
	feedbackDefaultPageSize  = 20
	feedbackMaxTopicPageSize = 100
	feedbackMsgPageSize      = 50
	// 消息分页上限放到 200：前端一次性拉满最近 200 条，保证 ≤200 条的工单完整
	// 显示、回复后新消息必现。超过 200 条（极罕见）只显示最旧 200 条，作为 v1
	// 已知限制，未来以「向上加载更早」补足（设计文档 §四 / §九）。
	feedbackMaxMsgPageSize = 200
)

// ─── 用户侧 ───────────────────────────────────────────────────────────────────

// GetUserFeedbackTopics GET /api/user/feedback/topics
func GetUserFeedbackTopics(c *gin.Context) {
	userId := c.GetInt("id")
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))
	category, _ := strconv.Atoi(c.DefaultQuery("category", "0"))
	page, pageSize := parsePaging(c, feedbackDefaultPageSize, feedbackMaxTopicPageSize)

	topics, total, err := model.GetUserFeedbackTopics(userId, status, category, page, pageSize)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败")
		return
	}
	items := make([]dto.FeedbackTopicItem, 0, len(topics))
	for _, t := range topics {
		items = append(items, feedbackTopicToItem(t, ""))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": items, "total": total})
}

// CreateFeedbackTopic POST /api/user/feedback/topics
func CreateFeedbackTopic(c *gin.Context) {
	userId := c.GetInt("id")
	var req dto.FeedbackCreateTopicRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" || utf8.RuneCountInString(title) > model.FeedbackMaxTitleLen {
		common.ApiErrorMsg(c, "标题不能为空且不超过 128 字")
		return
	}
	if !model.IsValidFeedbackCategory(req.Category) {
		common.ApiErrorMsg(c, "无效的分类")
		return
	}
	if utf8.RuneCountInString(req.Content) > model.FeedbackMaxContentLen {
		common.ApiErrorMsg(c, "内容长度超过上限")
		return
	}
	images, err := normalizeAndValidateFeedbackImages(req.Images)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	topic, err := model.CreateFeedbackTopic(userId, req.Category, title, req.Content, images)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "", "data": feedbackTopicToItem(topic, "")})
}

// GetUserFeedbackTopicDetail GET /api/user/feedback/topics/:id
func GetUserFeedbackTopicDetail(c *gin.Context) {
	userId := c.GetInt("id")
	id, ok := parseFeedbackId(c, "id")
	if !ok {
		return
	}
	topic, err := model.GetUserFeedbackTopicById(id, userId)
	if err != nil {
		feedbackNotFound(c)
		return
	}
	model.MarkFeedbackUserRead(id, userId)
	topic.UserUnread = false
	feedbackWriteDetail(c, topic, "")
}

// ReplyFeedbackTopic POST /api/user/feedback/topics/:id/messages
func ReplyFeedbackTopic(c *gin.Context) {
	userId := c.GetInt("id")
	id, ok := parseFeedbackId(c, "id")
	if !ok {
		return
	}
	// 归属校验
	if _, err := model.GetUserFeedbackTopicById(id, userId); err != nil {
		feedbackNotFound(c)
		return
	}
	feedbackAddMessage(c, id, userId, model.FeedbackAuthorUser)
}

// CloseFeedbackTopicByUser PUT /api/user/feedback/topics/:id/close
func CloseFeedbackTopicByUser(c *gin.Context) {
	userId := c.GetInt("id")
	id, ok := parseFeedbackId(c, "id")
	if !ok {
		return
	}
	if _, err := model.GetUserFeedbackTopicById(id, userId); err != nil {
		feedbackNotFound(c)
		return
	}
	if _, err := model.CloseFeedbackTopic(id, userId); err != nil {
		common.ApiErrorMsg(c, "关闭失败")
		return
	}
	common.ApiSuccess(c, nil)
}

// GetUserFeedbackImage GET /api/user/feedback/images/:imageId
func GetUserFeedbackImage(c *gin.Context) {
	userId := c.GetInt("id")
	id, ok := parseFeedbackId(c, "imageId")
	if !ok {
		return
	}
	img, err := model.GetFeedbackImageForUser(id, userId)
	if err != nil {
		feedbackNotFound(c)
		return
	}
	common.ApiSuccess(c, gin.H{"image": "data:image/jpeg;base64," + img.Data})
}

// GetUserFeedbackUnread GET /api/user/feedback/unread
func GetUserFeedbackUnread(c *gin.Context) {
	userId := c.GetInt("id")
	common.ApiSuccess(c, dto.FeedbackUnreadResponse{
		Unread:    model.GetUserUnreadCount(userId),
		HasTopics: model.UserHasFeedbackTopics(userId),
	})
}

// ─── 管理员侧 ─────────────────────────────────────────────────────────────────

// AdminGetFeedbackTopics GET /api/user/feedback/admin/topics
func AdminGetFeedbackTopics(c *gin.Context) {
	filterUserId, _ := strconv.Atoi(c.DefaultQuery("user_id", "0"))
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))
	category, _ := strconv.Atoi(c.DefaultQuery("category", "0"))
	username := strings.TrimSpace(c.Query("username"))
	keyword := strings.TrimSpace(c.Query("keyword"))
	page, pageSize := parsePaging(c, feedbackDefaultPageSize, feedbackMaxTopicPageSize)

	rows, total, err := model.GetFeedbackAdminTopics(filterUserId, status, category, username, keyword, page, pageSize)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败")
		return
	}
	items := make([]dto.FeedbackTopicItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, feedbackTopicToItem(&row.FeedbackTopic, row.Username))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": items, "total": total})
}

// AdminGetFeedbackTopicDetail GET /api/user/feedback/admin/topics/:id
func AdminGetFeedbackTopicDetail(c *gin.Context) {
	id, ok := parseFeedbackId(c, "id")
	if !ok {
		return
	}
	topic, err := model.GetFeedbackTopicById(id)
	if err != nil {
		feedbackNotFound(c)
		return
	}
	model.MarkFeedbackAdminRead(id)
	topic.AdminUnread = false

	username := ""
	if names := feedbackUsernames([]int{topic.UserId}); names != nil {
		username = names[topic.UserId]
	}
	feedbackWriteDetail(c, topic, username)
}

// AdminReplyFeedbackTopic POST /api/user/feedback/admin/topics/:id/messages
func AdminReplyFeedbackTopic(c *gin.Context) {
	adminId := c.GetInt("id")
	id, ok := parseFeedbackId(c, "id")
	if !ok {
		return
	}
	if _, err := model.GetFeedbackTopicById(id); err != nil {
		feedbackNotFound(c)
		return
	}
	feedbackAddMessage(c, id, adminId, model.FeedbackAuthorAdmin)
}

// AdminUpdateFeedbackStatus PUT /api/user/feedback/admin/topics/:id/status
func AdminUpdateFeedbackStatus(c *gin.Context) {
	adminId := c.GetInt("id")
	id, ok := parseFeedbackId(c, "id")
	if !ok {
		return
	}
	var req dto.FeedbackStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	// 仅允许管理员置 处理中 / 已关闭（其余状态由系统按转移表推导）
	if req.Status != model.FeedbackStatusProcessing && req.Status != model.FeedbackStatusClosed {
		common.ApiErrorMsg(c, "不允许的状态变更")
		return
	}
	topic, err := model.GetFeedbackTopicById(id)
	if err != nil {
		feedbackNotFound(c)
		return
	}
	if _, err := model.AdminUpdateFeedbackStatus(id, req.Status, adminId); err != nil {
		common.ApiErrorMsg(c, "状态更新失败")
		return
	}
	if req.Status == model.FeedbackStatusClosed {
		model.RecordLog(adminId, model.LogTypeManage,
			fmt.Sprintf("关闭用户 %d 的工单 (topic_id=%d)", topic.UserId, id))
	}
	common.ApiSuccess(c, nil)
}

// AdminGetFeedbackImage GET /api/user/feedback/admin/images/:imageId
func AdminGetFeedbackImage(c *gin.Context) {
	id, ok := parseFeedbackId(c, "imageId")
	if !ok {
		return
	}
	img, err := model.GetFeedbackImage(id)
	if err != nil {
		feedbackNotFound(c)
		return
	}
	common.ApiSuccess(c, gin.H{"image": "data:image/jpeg;base64," + img.Data})
}

// AdminGetFeedbackUnread GET /api/user/feedback/admin/unread
func AdminGetFeedbackUnread(c *gin.Context) {
	common.ApiSuccess(c, gin.H{"unread": model.GetAdminUnreadCount()})
}

// ─── 共享 helper ──────────────────────────────────────────────────────────────

// feedbackAddMessage 绑定回复请求、校验并写入一条消息（用户或管理员共用）。
// 调用前必须已完成归属/存在性校验。
func feedbackAddMessage(c *gin.Context, topicId, authorId, authorRole int) {
	var req dto.FeedbackReplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	if utf8.RuneCountInString(req.Content) > model.FeedbackMaxContentLen {
		common.ApiErrorMsg(c, "内容长度超过上限")
		return
	}
	images, err := normalizeAndValidateFeedbackImages(req.Images)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	msg, _, err := model.AddFeedbackMessage(topicId, authorId, authorRole, req.Content, images)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "", "data": feedbackMessageToItem(msg)})
}

// feedbackWriteDetail 读取消息分页并输出工单详情。
func feedbackWriteDetail(c *gin.Context, topic *model.FeedbackTopic, username string) {
	page, pageSize := parsePaging(c, feedbackMsgPageSize, feedbackMaxMsgPageSize)
	messages, total, err := model.GetFeedbackMessages(topic.Id, page, pageSize)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败")
		return
	}
	items := make([]dto.FeedbackMessageItem, 0, len(messages))
	for _, m := range messages {
		items = append(items, feedbackMessageToItem(m))
	}
	common.ApiSuccess(c, dto.FeedbackTopicDetailResponse{
		Topic:    feedbackTopicToItem(topic, username),
		Messages: items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// normalizeAndValidateFeedbackImages 去掉 data: 前缀、校验数量与体积/合法性。
func normalizeAndValidateFeedbackImages(images []string) ([]string, error) {
	if len(images) > model.FeedbackMaxImagesPerMessage {
		return nil, model.ErrFeedbackImageTooMany
	}
	out := make([]string, 0, len(images))
	for _, s := range images {
		if idx := strings.Index(s, ","); strings.HasPrefix(s, "data:") && idx >= 0 {
			s = s[idx+1:]
		}
		if s == "" {
			continue
		}
		if len(s) > model.FeedbackMaxImageBase64Len {
			return nil, model.ErrFeedbackImageTooBig
		}
		if _, err := base64.StdEncoding.DecodeString(s); err != nil {
			return nil, errors.New("图片数据无效")
		}
		out = append(out, s)
	}
	return out, nil
}

func parsePaging(c *gin.Context, defaultSize, maxSize int) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", strconv.Itoa(defaultSize)))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > maxSize {
		pageSize = defaultSize
	}
	return page, pageSize
}

// parseFeedbackId 解析路径参数为正整数，失败写 404 并返回 ok=false。
func parseFeedbackId(c *gin.Context, name string) (int, bool) {
	id, err := strconv.Atoi(c.Param(name))
	if err != nil || id <= 0 {
		feedbackNotFound(c)
		return 0, false
	}
	return id, true
}

// feedbackNotFound 统一 404（不区分"不存在"与"越权"，避免存在性泄露）。
func feedbackNotFound(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "工单不存在"})
}

func feedbackUsernames(ids []int) map[int]string {
	names := make(map[int]string)
	for _, id := range ids {
		if user, err := model.GetUserById(id, false); err == nil && user != nil {
			names[id] = user.Username
		}
	}
	return names
}

func feedbackTopicToItem(t *model.FeedbackTopic, username string) dto.FeedbackTopicItem {
	return dto.FeedbackTopicItem{
		Id:            t.Id,
		UserId:        t.UserId,
		Username:      username,
		Category:      t.Category,
		Title:         t.Title,
		Status:        t.Status,
		MessageCount:  t.MessageCount,
		LastReplyAt:   t.LastReplyAt,
		LastReplyRole: t.LastReplyRole,
		UserUnread:    t.UserUnread,
		AdminUnread:   t.AdminUnread,
		CreatedAt:     t.CreatedAt,
	}
}

func feedbackMessageToItem(m *model.FeedbackMessage) dto.FeedbackMessageItem {
	imageIds := m.ImageIds
	if imageIds == nil {
		imageIds = []int{}
	}
	return dto.FeedbackMessageItem{
		Id:         m.Id,
		AuthorId:   m.UserId,
		AuthorRole: m.AuthorRole,
		AuthorName: m.AuthorName,
		Content:    m.Content,
		ImageIds:   imageIds,
		CreatedAt:  m.CreatedAt,
	}
}
