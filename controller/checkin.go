package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const minCheckinCaptchaDurationMs int64 = 3000

type checkinRequest struct {
	CaptchaId           string                         `json:"captcha_id"`
	CaptchaAnswer       string                         `json:"captcha_answer"`
	CaptchaDisplayCount int                            `json:"captcha_display_count"`
	CaptchaFirstSeenAt  int64                          `json:"captcha_first_seen_at"`
	ClientSubmittedAt   int64                          `json:"client_submitted_at"`
	CaptchaKeyInputs    []model.CheckinCaptchaKeyInput `json:"captcha_key_inputs"`
}

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}
	userId := c.GetInt("id")
	// 获取月份参数，默认为当前月份
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	respData := gin.H{
		"enabled":   setting.Enabled,
		"min_quota": setting.MinQuota,
		"max_quota": setting.MaxQuota,
		"stats":     stats,
	}
	if user, err := model.GetUserById(userId, false); err == nil && user.Tag != "" {
		respData["tag"] = user.Tag
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    respData,
	})
}

// DoCheckin 执行用户签到
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}

	req := parseCheckinRequest(c)
	captchaSubmittedAt := time.Now().UnixMilli()

	if req.CaptchaId == "" || req.CaptchaAnswer == "" {
		common.ApiErrorMsg(c, "请输入图形验证码")
		return
	}

	// 以验证码图片下发时间（服务端）计时，客户端 first_seen 仅作遥测
	createdAt, exists := common.PeekCaptchaMeta(req.CaptchaId)
	if !exists {
		common.ApiErrorMsg(c, "图形验证码错误或已过期，请刷新重试")
		return
	}
	// 旧格式无签发时间：不允许跳过时长校验，要求刷新重新获取验证码
	if createdAt <= 0 {
		common.ApiErrorMsg(c, "验证码已失效，请刷新页面重新签到。")
		return
	}
	durationMs := captchaSubmittedAt - createdAt
	if durationMs < 0 {
		durationMs = 0
	}
	if durationMs < minCheckinCaptchaDurationMs {
		// 未消费验证码，用户只需等待后重试
		common.ApiErrorMsg(c, "操作过快，请等待几秒后再提交。")
		return
	}
	if !common.VerifyCaptcha(req.CaptchaId, req.CaptchaAnswer) {
		common.ApiErrorMsg(c, "图形验证码错误或已过期，请刷新重试")
		return
	}

	if req.CaptchaFirstSeenAt <= 0 {
		req.CaptchaFirstSeenAt = 0
	}
	if req.ClientSubmittedAt <= 0 {
		req.ClientSubmittedAt = 0
	}
	if req.CaptchaDisplayCount < 0 {
		req.CaptchaDisplayCount = 0
	}
	req.CaptchaKeyInputs = sanitizeCheckinCaptchaKeyInputs(req.CaptchaKeyInputs)

	userId := c.GetInt("id")
	checkin, riskDetail, err := model.UserCheckin(userId, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.RecordCheckinLog(
		userId,
		fmt.Sprintf("用户签到，获得额度 %s", logger.LogQuota(checkin.QuotaAwarded)),
		c.ClientIP(),
		riskDetail,
		durationMs,
		req.CaptchaDisplayCount,
		req.CaptchaAnswer,
		req.CaptchaFirstSeenAt,
		createdAt,
		captchaSubmittedAt,
		req.ClientSubmittedAt,
		req.CaptchaKeyInputs,
	)
	validDays := operation_setting.GetCheckinValidDays()
	respData := gin.H{
		"quota_awarded": checkin.QuotaAwarded,
		"checkin_date":  checkin.CheckinDate,
		"valid_days":    validDays,
	}
	// 如果命中风控，返回标签
	if riskDetail != "" {
		respData["tag"] = "签到高风险"
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("签到成功，签到额度有效期 %d 天，不使用会过期", validDays),
		"data":    respData,
	})
}

func parseCheckinRequest(c *gin.Context) checkinRequest {
	var req checkinRequest
	// 优先 JSON body（遥测字段可能较大）；兼容旧 query 方式
	if c.Request.Body != nil && c.Request.ContentLength != 0 {
		body, err := io.ReadAll(c.Request.Body)
		if err == nil && len(body) > 0 {
			_ = common.Unmarshal(body, &req)
		}
	}
	if req.CaptchaId == "" {
		req.CaptchaId = c.Query("captcha_id")
	}
	if req.CaptchaAnswer == "" {
		req.CaptchaAnswer = c.Query("captcha_answer")
	}
	if req.CaptchaDisplayCount == 0 {
		if v, err := strconv.Atoi(c.Query("captcha_display_count")); err == nil {
			req.CaptchaDisplayCount = v
		}
	}
	if req.CaptchaFirstSeenAt == 0 {
		if v, err := strconv.ParseInt(c.Query("captcha_first_seen_at"), 10, 64); err == nil {
			req.CaptchaFirstSeenAt = v
		}
	}
	if req.ClientSubmittedAt == 0 {
		if v, err := strconv.ParseInt(c.Query("client_submitted_at"), 10, 64); err == nil {
			req.ClientSubmittedAt = v
		}
	}
	if len(req.CaptchaKeyInputs) == 0 {
		req.CaptchaKeyInputs = sanitizeCheckinCaptchaKeyInputs(parseCheckinCaptchaKeyInputs(c.Query("captcha_key_inputs")))
	}
	return req
}

func parseCheckinCaptchaKeyInputs(raw string) []model.CheckinCaptchaKeyInput {
	if raw == "" {
		return nil
	}
	var inputs []model.CheckinCaptchaKeyInput
	if err := common.UnmarshalJsonStr(raw, &inputs); err != nil {
		return nil
	}
	return inputs
}

func sanitizeCheckinCaptchaKeyInputs(inputs []model.CheckinCaptchaKeyInput) []model.CheckinCaptchaKeyInput {
	if len(inputs) == 0 {
		return nil
	}
	const maxCaptchaKeyInputs = 32
	if len(inputs) > maxCaptchaKeyInputs {
		inputs = inputs[:maxCaptchaKeyInputs]
	}
	sanitized := make([]model.CheckinCaptchaKeyInput, 0, len(inputs))
	for _, input := range inputs {
		input.Digit = strings.TrimSpace(input.Digit)
		if len(input.Digit) != 1 || input.Digit[0] < '0' || input.Digit[0] > '9' {
			continue
		}
		if input.Order <= 0 {
			input.Order = len(sanitized) + 1
		}
		if input.Position <= 0 {
			input.Position = input.Order
		}
		if input.DisplayCount < 0 {
			input.DisplayCount = 0
		}
		if input.Timestamp < 0 {
			input.Timestamp = 0
		}
		if input.ElapsedMs < 0 {
			input.ElapsedMs = 0
		}
		if input.IntervalMs < 0 {
			input.IntervalMs = 0
		}
		sanitized = append(sanitized, input)
	}
	return sanitized
}
