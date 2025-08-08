package controller

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"one-api/common"
	"one-api/model"
	"one-api/setting"

	"github.com/gin-gonic/gin"
)

// User 结构体对应 Webhook JSON 中的 "user" 对象
type OpenWebUIUser struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
}

// WebhookPayload 结构体对应整个 Webhook 的 JSON 负载
type OpenWebUIWebhookPayload struct {
	EventType string `json:"action"`
	Message   string `json:"message"`
	UserData  string `json:"user"`  // 改为字符串
}

func OpenWebUIWebhook(c *gin.Context) {
	var payload OpenWebUIWebhookPayload
	// 使用 ShouldBindJSON 将请求体绑定到 payload 结构体上
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.LogError(c, fmt.Sprintf("错误：无法解析请求体: %v", err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求体"})
		return
	}

	// 手动解析 user 字符串
    var user OpenWebUIUser
    if err := json.Unmarshal([]byte(payload.UserData), &user); err != nil {
        common.LogError(c, fmt.Sprintf("错误：无法解析用户数据: %v", err))
        c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户数据"})
        return
    }

	// 检查事件类型是否是我们期望的 "signup"
	if payload.EventType == "signup" {
		// 在这里执行你的自定义操作
		common.LogInfo(c, fmt.Sprintf("收到新用户注册事件: %s, %s", user.Name, user.Email))
		// 创建用户
		if user.Email == "" {
			log.Printf("邮箱为空")
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "邮箱为空",
			})
			return
		}
		var localUser model.User
		if model.IsEmailAlreadyTaken(user.Email) {
			common.LogWarn(c, fmt.Sprintf("邮箱已被注册: %s", user.Email))
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "邮箱已被注册",
			})
			return
		} 
		// 注册用户
		initialPassword := common.GetRandomString(10)
		localUser.Username = user.Name
		localUser.Email = user.Email
		localUser.Role = common.RoleCommonUser
		localUser.Status = common.UserStatusEnabled
		localUser.Password = initialPassword
		common.LogInfo(c, fmt.Sprintf("注册用户: %s, 邮箱: %s, 初始密码: %s", localUser.Username, user.Email, initialPassword))
		if err := localUser.Insert(0); err != nil {
			common.ApiError(c, err)
			return
		}
		// 向用户发送邮件
		link := fmt.Sprintf("%s/console/token", setting.ServerAddress)
		subject := fmt.Sprintf("欢迎使用%s", common.SystemName)
		content := fmt.Sprintf("<p>您好，欢迎使用%s！</p>"+
			"<p>您的账号信息如下：<br>"+
			"账号：%s<br>"+
			"初始密码：%s</p>"+
			"<p>请点击<a href='%s'>这里</a>添加您的API令牌。</p>"+
			"<p>若无法点击链接，请复制以下地址到浏览器访问：<br>%s</p>",
			common.SystemName, user.Email, initialPassword, link, link)
		err := common.SendEmail(subject, user.Email, content)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		log.Printf("接收到非用户创建事件: %s", payload.EventType)
		log.Printf("   %v", payload)
	}

	// 4. 响应请求
	// 告诉 Open WebUI 你已经成功处理了该事件
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
