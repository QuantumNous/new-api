package controller

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const userSendEmailChallengeTTL = 10 * time.Minute

type userSendEmailChallenge struct {
	Email     string
	Code      string
	CreatedAt time.Time
	Verified  bool
}

type userSendEmailRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type cloudMailEmail struct {
	EmailID    int64  `json:"emailId"`
	SendEmail  string `json:"sendEmail"`
	Subject    string `json:"subject"`
	Content    string `json:"content"`
	ToEmail    string `json:"toEmail"`
	CreateTime string `json:"createTime"`
	Type       int    `json:"type"`
	IsDel      int    `json:"isDel"`
}

type cloudMailEmailListResponse struct {
	Code    int              `json:"code"`
	Message string           `json:"message"`
	Data    []cloudMailEmail `json:"data"`
}

var userSendEmailChallenges = struct {
	sync.Mutex
	values map[string]userSendEmailChallenge
}{values: make(map[string]userSendEmailChallenge)}

func CreateUserSendEmailChallenge(c *gin.Context) {
	if !common.UserSendEmailVerificationEnabled {
		common.ApiErrorMsg(c, "用户发信验证未启用")
		return
	}

	var req userSendEmailRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的请求参数")
		return
	}
	email := model.NormalizeEmail(req.Email)
	if err := common.Validate.Var(email, "required,email"); err != nil {
		common.ApiErrorMsg(c, "无效的邮箱地址")
		return
	}
	if err := model.EnsureEmailAvailable(email, 0); err != nil {
		common.ApiErrorMsg(c, "该邮箱已被使用")
		return
	}

	random := make([]byte, 8)
	if _, err := rand.Read(random); err != nil {
		common.ApiErrorMsg(c, "生成验证挑战失败")
		return
	}
	code := strings.ToUpper(hex.EncodeToString(random))
	now := time.Now().UTC()

	userSendEmailChallenges.Lock()
	for key, value := range userSendEmailChallenges.values {
		if now.Sub(value.CreatedAt) >= userSendEmailChallengeTTL {
			delete(userSendEmailChallenges.values, key)
		}
	}
	userSendEmailChallenges.values[email] = userSendEmailChallenge{Email: email, Code: code, CreatedAt: now}
	userSendEmailChallenges.Unlock()

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
		"code": code, "recipient": common.CloudMailRecipient, "expires_in": int(userSendEmailChallengeTTL.Seconds()),
	}})
}

func CheckUserSendEmailChallenge(c *gin.Context) {
	if !common.UserSendEmailVerificationEnabled {
		common.ApiErrorMsg(c, "用户发信验证未启用")
		return
	}

	var req userSendEmailRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的请求参数")
		return
	}
	email := model.NormalizeEmail(req.Email)
	challenge, ok := getUserSendEmailChallenge(email, req.Code)
	if !ok {
		common.ApiErrorMsg(c, "验证挑战无效或已过期")
		return
	}

	found, err := findCloudMailVerification(c.Request.Context(), challenge)
	if err != nil {
		common.SysError("Cloud Mail verification failed: " + err.Error())
		common.ApiErrorMsg(c, "暂时无法查询验证邮件，请稍后重试")
		return
	}
	if !found {
		common.ApiErrorMsg(c, "尚未收到匹配的验证邮件")
		return
	}

	userSendEmailChallenges.Lock()
	current, exists := userSendEmailChallenges.values[email]
	if !exists || subtle.ConstantTimeCompare([]byte(current.Code), []byte(challenge.Code)) != 1 || time.Since(current.CreatedAt) >= userSendEmailChallengeTTL {
		userSendEmailChallenges.Unlock()
		common.ApiErrorMsg(c, "验证挑战已更新或过期，请重新验证")
		return
	}
	current.Verified = true
	userSendEmailChallenges.values[email] = current
	userSendEmailChallenges.Unlock()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func getUserSendEmailChallenge(email, code string) (userSendEmailChallenge, bool) {
	userSendEmailChallenges.Lock()
	defer userSendEmailChallenges.Unlock()
	challenge, ok := userSendEmailChallenges.values[email]
	if !ok || time.Since(challenge.CreatedAt) >= userSendEmailChallengeTTL || subtle.ConstantTimeCompare([]byte(challenge.Code), []byte(strings.TrimSpace(code))) != 1 {
		return userSendEmailChallenge{}, false
	}
	return challenge, true
}

func consumeUserSendEmailChallenge(email, code string) bool {
	email = model.NormalizeEmail(email)
	userSendEmailChallenges.Lock()
	defer userSendEmailChallenges.Unlock()
	challenge, ok := userSendEmailChallenges.values[email]
	if !ok || !challenge.Verified || time.Since(challenge.CreatedAt) >= userSendEmailChallengeTTL || subtle.ConstantTimeCompare([]byte(challenge.Code), []byte(strings.TrimSpace(code))) != 1 {
		return false
	}
	delete(userSendEmailChallenges.values, email)
	return true
}

func findCloudMailVerification(ctx context.Context, challenge userSendEmailChallenge) (bool, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(common.CloudMailBaseURL), "/")
	parsed, err := url.Parse(baseURL + "/api/public/emailList")
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return false, errors.New("invalid Cloud Mail base URL")
	}
	payload, err := common.Marshal(map[string]any{
		"toEmail": common.CloudMailRecipient, "sendEmail": challenge.Email, "content": "%" + challenge.Code + "%",
		"timeSort": "desc", "type": 0, "isDel": 0, "num": 1, "size": 20,
	})
	if err != nil {
		return false, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, parsed.String(), bytes.NewReader(payload))
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", strings.TrimSpace(common.CloudMailToken))
	req.Header.Set("Content-Type", "application/json")
	resp, err := service.GetSSRFProtectedHTTPClient().Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("Cloud Mail returned HTTP %d", resp.StatusCode)
	}
	var result cloudMailEmailListResponse
	if err := common.DecodeJson(resp.Body, &result); err != nil {
		return false, err
	}
	if result.Code != http.StatusOK {
		return false, fmt.Errorf("Cloud Mail returned code %d: %s", result.Code, result.Message)
	}
	for _, email := range result.Data {
		if isCloudMailVerificationEmail(email, challenge) {
			return true, nil
		}
	}
	return false, nil
}

func isCloudMailVerificationEmail(email cloudMailEmail, challenge userSendEmailChallenge) bool {
	return email.Type == 0 && email.IsDel == 0 &&
		strings.EqualFold(model.NormalizeEmail(email.SendEmail), challenge.Email) &&
		strings.EqualFold(model.NormalizeEmail(email.ToEmail), model.NormalizeEmail(common.CloudMailRecipient)) &&
		strings.Contains(email.Content, challenge.Code)
}
