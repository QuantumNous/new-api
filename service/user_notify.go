package service

import (
	"github.com/QuantumNous/new-api/i18n"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func NotifyRootUser(t string, subject string, content string) {
	user := model.GetRootUser().ToBaseUser()
	err := NotifyUser(user.Id, user.Email, user.GetSetting(), dto.NewNotify(t, subject, content, nil))
	if err != nil {
		common.SysLog(fmt.Sprintf(i18n.Translate("svc.failed_to_notify_root_user"), err.Error()))
	}
}

// NotifyUpstreamModelUpdateWatchers broadcasts an upstream model update notification
// to all admin users who opted in. The subject and content are rendered per-user in
// their preferred language via the provided builder, so each recipient receives the
// message localized to their own setting instead of the server default.
func NotifyUpstreamModelUpdateWatchers(build func(lang string) (subject string, content string)) {
	var users []model.User
	if err := model.DB.
		Select("id", "email", "role", "status", "setting").
		Where("status = ? AND role >= ?", common.UserStatusEnabled, common.RoleAdminUser).
		Find(&users).Error; err != nil {
		common.SysLog(fmt.Sprintf(i18n.Translate("svc.failed_to_query_upstream_update_notification_users"), err.Error()))
		return
	}

	sentCount := 0
	for _, user := range users {
		userSetting := user.GetSetting()
		if !userSetting.UpstreamModelUpdateNotifyEnabled {
			continue
		}
		subject, content := build(userSetting.Language)
		notification := dto.NewNotify(dto.NotifyTypeChannelUpdate, subject, content, nil)
		if err := NotifyUser(user.Id, user.Email, userSetting, notification); err != nil {
			common.SysLog(fmt.Sprintf(i18n.Translate("svc.failed_to_notify_user_for_upstream_model"), user.Id, err.Error()))
			continue
		}
		sentCount++
	}
	common.SysLog(fmt.Sprintf(i18n.Translate("svc.upstream_model_update_notifications_sent"), sentCount))
}

func NotifyUser(userId int, userEmail string, userSetting dto.UserSetting, data dto.Notify) error {
	notifyType := userSetting.NotifyType
	if notifyType == "" {
		notifyType = dto.NotifyTypeEmail
	}

	// Check notification limit
	canSend, err := CheckNotificationLimit(userId, data.Type)
	if err != nil {
		common.SysLog(fmt.Sprintf(i18n.Translate("svc.failed_to_check_notification_limit"), err.Error()))
		return err
	}
	if !canSend {
		return fmt.Errorf(i18n.Translate("svc.notification_limit_exceeded_for_user_ith_type"), userId, notifyType)
	}

	switch notifyType {
	case dto.NotifyTypeEmail:
		// 优先使用设置中的通知邮箱。
		// 对于用户主动订阅类通知（如额度预警），必须显式设置通知邮箱才会发送，
		// 避免向仅用于登录的绑定邮箱发送非必要通知。
		emailToUse := userSetting.NotificationEmail
		if emailToUse == "" && data.Type != dto.NotifyTypeQuotaExceed {
			emailToUse = userEmail
		}
		if emailToUse == "" {
			common.SysLog(fmt.Sprintf(i18n.Translate("svc.user_has_no_email_skip_sending_email"), userId))
			return nil
		}
		return sendEmailNotify(emailToUse, data)
	case dto.NotifyTypeWebhook:
		webhookURLStr := userSetting.WebhookUrl
		if webhookURLStr == "" {
			common.SysLog(fmt.Sprintf(i18n.Translate("svc.user_has_no_webhook_url_skip_sending"), userId))
			return nil
		}

		// 获取 webhook secret
		webhookSecret := userSetting.WebhookSecret
		return SendWebhookNotify(webhookURLStr, webhookSecret, data)
	case dto.NotifyTypeBark:
		barkURL := userSetting.BarkUrl
		if barkURL == "" {
			common.SysLog(fmt.Sprintf(i18n.Translate("svc.user_has_no_bark_url_skip_sending"), userId))
			return nil
		}
		return sendBarkNotify(barkURL, data)
	case dto.NotifyTypeGotify:
		gotifyUrl := userSetting.GotifyUrl
		gotifyToken := userSetting.GotifyToken
		if gotifyUrl == "" || gotifyToken == "" {
			common.SysLog(fmt.Sprintf(i18n.Translate("svc.user_has_no_gotify_url_or_token"), userId))
			return nil
		}
		return sendGotifyNotify(gotifyUrl, gotifyToken, userSetting.GotifyPriority, data)
	}
	return nil
}

func sendEmailNotify(userEmail string, data dto.Notify) error {
	// make email content
	content := data.Content
	// 处理占位符
	for _, value := range data.Values {
		content = strings.Replace(content, dto.ContentValueParam, fmt.Sprintf("%v", value), 1)
	}
	return common.SendEmail(data.Title, userEmail, content)
}

func sendBarkNotify(barkURL string, data dto.Notify) error {
	// 处理占位符
	content := data.Content
	for _, value := range data.Values {
		content = strings.Replace(content, dto.ContentValueParam, fmt.Sprintf("%v", value), 1)
	}

	// 替换模板变量
	finalURL := strings.ReplaceAll(barkURL, "{{title}}", url.QueryEscape(data.Title))
	finalURL = strings.ReplaceAll(finalURL, "{{content}}", url.QueryEscape(content))

	// 发送GET请求到Bark
	var req *http.Request
	var resp *http.Response
	var err error

	if system_setting.EnableWorker() {
		// 使用worker发送请求
		workerReq := &WorkerRequest{
			URL:    finalURL,
			Key:    system_setting.WorkerValidKey,
			Method: http.MethodGet,
			Headers: map[string]string{
				"User-Agent": "OneAPI-Bark-Notify/1.0",
			},
		}

		resp, err = DoWorkerRequest(workerReq)
		if err != nil {
			return fmt.Errorf(i18n.Translate("svc.failed_to_send_bark_request_through_worker"), err)
		}
		defer resp.Body.Close()

		// 检查响应状态
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf(i18n.Translate("svc.bark_request_failed_with_status_code"), resp.StatusCode)
		}
	} else {
		// SSRF防护：验证Bark URL（非Worker模式）
		fetchSetting := system_setting.GetFetchSetting()
		if err := common.ValidateURLWithFetchSetting(finalURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
			return fmt.Errorf(i18n.Translate("svc.request_reject_1fbf"), err)
		}

		// 直接发送请求
		req, err = http.NewRequest(http.MethodGet, finalURL, nil)
		if err != nil {
			return fmt.Errorf(i18n.Translate("svc.failed_to_create_bark_request"), err)
		}

		// 设置User-Agent
		req.Header.Set("User-Agent", "OneAPI-Bark-Notify/1.0")

		// 发送请求
		client := GetHttpClient()
		resp, err = client.Do(req)
		if err != nil {
			return fmt.Errorf(i18n.Translate("svc.failed_to_send_bark_request"), err)
		}
		defer resp.Body.Close()

		// 检查响应状态
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf(i18n.Translate("svc.bark_request_failed_with_status_code_b220"), resp.StatusCode)
		}
	}

	return nil
}

func sendGotifyNotify(gotifyUrl string, gotifyToken string, priority int, data dto.Notify) error {
	// 处理占位符
	content := data.Content
	for _, value := range data.Values {
		content = strings.Replace(content, dto.ContentValueParam, fmt.Sprintf("%v", value), 1)
	}

	// 构建完整的 Gotify API URL
	// 确保 URL 以 /message 结尾
	finalURL := strings.TrimSuffix(gotifyUrl, "/") + "/message?token=" + url.QueryEscape(gotifyToken)

	// Gotify优先级范围0-10，如果超出范围则使用默认值5
	if priority < 0 || priority > 10 {
		priority = 5
	}

	// 构建 JSON payload
	type GotifyMessage struct {
		Title    string `json:"title"`
		Message  string `json:"message"`
		Priority int    `json:"priority"`
	}

	payload := GotifyMessage{
		Title:    data.Title,
		Message:  content,
		Priority: priority,
	}

	// 序列化为 JSON
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf(i18n.Translate("svc.failed_to_marshal_gotify_payload"), err)
	}

	var req *http.Request
	var resp *http.Response

	if system_setting.EnableWorker() {
		// 使用worker发送请求
		workerReq := &WorkerRequest{
			URL:    finalURL,
			Key:    system_setting.WorkerValidKey,
			Method: http.MethodPost,
			Headers: map[string]string{
				"Content-Type": "application/json; charset=utf-8",
				"User-Agent":   "OneAPI-Gotify-Notify/1.0",
			},
			Body: payloadBytes,
		}

		resp, err = DoWorkerRequest(workerReq)
		if err != nil {
			return fmt.Errorf(i18n.Translate("svc.failed_to_send_gotify_request_through_worker"), err)
		}
		defer resp.Body.Close()

		// 检查响应状态
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf(i18n.Translate("svc.gotify_request_failed_with_status_code"), resp.StatusCode)
		}
	} else {
		// SSRF防护：验证Gotify URL（非Worker模式）
		fetchSetting := system_setting.GetFetchSetting()
		if err := common.ValidateURLWithFetchSetting(finalURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
			return fmt.Errorf(i18n.Translate("svc.request_reject_ef0f"), err)
		}

		// 直接发送请求
		req, err = http.NewRequest(http.MethodPost, finalURL, bytes.NewBuffer(payloadBytes))
		if err != nil {
			return fmt.Errorf(i18n.Translate("svc.failed_to_create_gotify_request"), err)
		}

		// 设置请求头
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
		req.Header.Set("User-Agent", "NewAPI-Gotify-Notify/1.0")

		// 发送请求
		client := GetHttpClient()
		resp, err = client.Do(req)
		if err != nil {
			return fmt.Errorf(i18n.Translate("svc.failed_to_send_gotify_request"), err)
		}
		defer resp.Body.Close()

		// 检查响应状态
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf(i18n.Translate("svc.gotify_request_failed_with_status_code_abb9"), resp.StatusCode)
		}
	}

	return nil
}
