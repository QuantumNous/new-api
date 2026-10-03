package controller

// ZCode StartPlan 渠道授权：选择 zai / bigmodel，成功后保存 ZCode JWT。

import (
	"context"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// 流程状态存 gin session（对齐 codex_oauth.go），服务端本地过期兜底 15 分钟。
const zcodeStartPlanAuthFlowTTL = 15 * time.Minute

func zcodeStartPlanAuthSessionKey(channelID int, field string) string {
	return "zcode_start_plan_auth_" + field + "_" + strconv.Itoa(channelID)
}

func loadZcodeStartPlanChannel(c *gin.Context) (*model.Channel, bool) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgChannelIdFormatError)
		return nil, false
	}
	ch, err := model.GetChannelById(channelID, false)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	if ch == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": i18n.T(c, i18n.MsgChannelNotExists)})
		return nil, false
	}
	if ch.Type != constant.ChannelTypeZhipu_v4 && ch.Type != constant.ChannelTypeZhipu {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": i18n.T(c, i18n.MsgChannelTypeNotMatched)})
		return nil, false
	}
	if !isZcodeStartPlanBaseURL(ch.GetBaseURL()) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": i18n.T(c, i18n.MsgChannelCodingPlanOnly)})
		return nil, false
	}
	if ch.ChannelInfo.IsMultiKey {
		common.ApiErrorI18n(c, i18n.MsgChannelMultiKeyUnsupported)
		return nil, false
	}
	return ch, true
}

func parseZcodeStartPlanProvider(c *gin.Context) (string, error) {
	var request struct {
		Provider string `json:"provider"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil && err != io.EOF {
		return "", err
	}
	return service.NormalizeZcodeOAuthProvider(request.Provider)
}

func InitZcodeStartPlanAuth(c *gin.Context) {
	ch, ok := loadZcodeStartPlanChannel(c)
	if !ok {
		return
	}

	provider, err := parseZcodeStartPlanProvider(c)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	flow, err := service.InitZcodeCliOAuth(ctx, ch.GetSetting().Proxy, provider)
	if err != nil {
		common.SysError("failed to init zcode start plan oauth: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "发起授权失败，请稍后重试"})
		return
	}

	session := sessions.Default(c)
	session.Set(zcodeStartPlanAuthSessionKey(ch.Id, "flow_id"), flow.FlowID)
	session.Set(zcodeStartPlanAuthSessionKey(ch.Id, "poll_token"), flow.PollToken)
	session.Set(zcodeStartPlanAuthSessionKey(ch.Id, "provider"), provider)
	session.Set(zcodeStartPlanAuthSessionKey(ch.Id, "expires_at"), flow.ExpiresAt)
	session.Set(zcodeStartPlanAuthSessionKey(ch.Id, "created_at"), time.Now().Unix())
	_ = session.Save()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"channel_id":        ch.Id,
			"provider":          provider,
			"authorize_url":     flow.AuthorizeURL,
			"expires_at":        flow.ExpiresAt,
			"poll_interval_sec": flow.PollIntervalSec,
		},
	})
}

func PollZcodeStartPlanAuth(c *gin.Context) {
	ch, ok := loadZcodeStartPlanChannel(c)
	if !ok {
		return
	}

	session := sessions.Default(c)
	flowID, _ := session.Get(zcodeStartPlanAuthSessionKey(ch.Id, "flow_id")).(string)
	pollToken, _ := session.Get(zcodeStartPlanAuthSessionKey(ch.Id, "poll_token")).(string)
	createdAt, _ := session.Get(zcodeStartPlanAuthSessionKey(ch.Id, "created_at")).(int64)
	provider, err := zcodeStartPlanSessionProvider(session, ch.Id)
	if err != nil {
		clearZcodeStartPlanAuthSession(c, ch.Id)
		common.ApiErrorI18n(c, i18n.MsgOAuthFlowNotStarted)
		return
	}
	if flowID == "" || pollToken == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthFlowNotStarted)})
		return
	}
	if createdAt > 0 && time.Since(time.Unix(createdAt, 0)) > zcodeStartPlanAuthFlowTTL {
		clearZcodeStartPlanAuthSession(c, ch.Id)
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "expired"}})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	result, err := service.PollZcodeCliOAuth(ctx, ch.GetSetting().Proxy, flowID, pollToken, provider)
	if err != nil {
		common.SysError("failed to poll zcode start plan oauth: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "查询授权状态失败，请重试"})
		return
	}

	switch result.Status {
	case "pending":
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "pending"}})
	case "failed":
		clearZcodeStartPlanAuthSession(c, ch.Id)
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "failed"}})
	case "ready":
		updated, err := model.UpdateSingleChannelKey(ch.Id, result.Token)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if !updated {
			common.ApiErrorI18n(c, i18n.MsgChannelMultiKeyUnsupported)
			return
		}
		clearZcodeStartPlanAuthSession(c, ch.Id)
		model.InitChannelCache()
		service.ResetProxyClientCache()

		data := gin.H{
			"status":    "ready",
			"provider":  provider,
			"user_id":   result.UserID,
			"user_name": result.Name,
			"email":     result.Email,
		}
		if exp, expOK := service.ExtractZcodeJWTExpiration(result.Token); expOK {
			data["jwt_expires_at"] = exp
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "saved", "data": data})
	default:
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未知授权状态: " + result.Status})
	}
}

// 兼容升级前已开始的国际授权；provider 只取会话，不接受轮询参数覆盖。
func zcodeStartPlanSessionProvider(session sessions.Session, channelID int) (string, error) {
	provider, _ := session.Get(zcodeStartPlanAuthSessionKey(channelID, "provider")).(string)
	return service.NormalizeZcodeOAuthProvider(provider)
}

func clearZcodeStartPlanAuthSession(c *gin.Context, channelID int) {
	session := sessions.Default(c)
	for _, field := range []string{"flow_id", "poll_token", "provider", "expires_at", "created_at"} {
		session.Delete(zcodeStartPlanAuthSessionKey(channelID, field))
	}
	_ = session.Save()
}
