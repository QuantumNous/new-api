package controller

import (
	"net/http"
	"net/mail"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type CreateFeedbackRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Category string `json:"category"`
	Content  string `json:"content"`
}

var allowedFeedbackCategories = map[string]struct{}{
	"bug":        {},
	"consulting": {},
	"feature":    {},
	"other":      {},
}

func SubmitFeedback(c *gin.Context) {
	var req CreateFeedbackRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	req.Category = strings.TrimSpace(req.Category)
	req.Content = strings.TrimSpace(req.Content)

	if len(req.Username) < 2 || len(req.Username) > 64 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户名长度必须在 2 到 64 个字符之间"})
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "邮箱格式无效"})
		return
	}
	if _, ok := allowedFeedbackCategories[req.Category]; !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "反馈类型无效"})
		return
	}
	if len(req.Content) < 10 || len(req.Content) > 5000 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "反馈内容长度必须在 10 到 5000 个字符之间"})
		return
	}

	now := common.GetTimestamp()
	feedback := &model.Feedback{
		Username:    req.Username,
		Email:       req.Email,
		Category:    req.Category,
		Content:     req.Content,
		CreatedTime: now,
		UpdatedTime: now,
	}
	if err := feedback.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.NotifyFeedbackLarkWebhook(feedback); err != nil {
		common.SysError("failed to send feedback lark webhook: " + err.Error())
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "提交成功",
		"data":    feedback,
	})
}

func GetAllFeedbacks(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	category := strings.TrimSpace(c.Query("category"))
	keyword := strings.TrimSpace(c.Query("keyword"))
	feedbacks, total, err := model.GetAllFeedbacks(category, keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(feedbacks)
	common.ApiSuccess(c, pageInfo)
}
