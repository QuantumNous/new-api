package controller

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/codex"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

type codexOAuthCompleteRequest struct {
	Input string `json:"input"`
}

func codexOAuthSessionKey(channelID int, field string) string {
	return fmt.Sprintf("codex_oauth_%s_%d", field, channelID)
}

func parseCodexAuthorizationInput(input string) (code string, state string, err error) {
	v := strings.TrimSpace(input)
	if v == "" {
		return "", "", errors.New("empty input")
	}
	if strings.Contains(v, "#") {
		parts := strings.SplitN(v, "#", 2)
		code = strings.TrimSpace(parts[0])
		state = strings.TrimSpace(parts[1])
		return code, state, nil
	}
	if strings.Contains(v, "code=") {
		u, parseErr := url.Parse(v)
		if parseErr == nil {
			q := u.Query()
			code = strings.TrimSpace(q.Get("code"))
			state = strings.TrimSpace(q.Get("state"))
			return code, state, nil
		}
		q, parseErr := url.ParseQuery(v)
		if parseErr == nil {
			code = strings.TrimSpace(q.Get("code"))
			state = strings.TrimSpace(q.Get("state"))
			return code, state, nil
		}
	}

	code = v
	return code, "", nil
}

func StartCodexOAuth(c fuego.ContextNoBody) (*dto.Response[dto.CodexOAuthStartData], error) {
	return startCodexOAuthWithChannelID(dto.GinCtx(c), 0)
}

func StartCodexOAuthForChannel(c fuego.ContextNoBody) (*dto.Response[dto.CodexOAuthStartData], error) {
	channelID, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[dto.CodexOAuthStartData](fmt.Sprintf("invalid channel id: %v", err))
	}
	return startCodexOAuthWithChannelID(dto.GinCtx(c), channelID)
}

func startCodexOAuthWithChannelID(ginCtx *gin.Context, channelID int) (*dto.Response[dto.CodexOAuthStartData], error) {
	if channelID > 0 {
		ch, err := model.GetChannelById(channelID, false)
		if err != nil {
			return dto.Fail[dto.CodexOAuthStartData](err.Error())
		}
		if ch == nil {
			return dto.Fail[dto.CodexOAuthStartData]("channel not found")
		}
		if ch.Type != constant.ChannelTypeCodex {
			return dto.Fail[dto.CodexOAuthStartData]("channel type is not Codex")
		}
	}

	flow, err := service.CreateCodexOAuthAuthorizationFlow()
	if err != nil {
		return dto.Fail[dto.CodexOAuthStartData](err.Error())
	}

	session := sessions.Default(ginCtx)
	session.Set(codexOAuthSessionKey(channelID, "state"), flow.State)
	session.Set(codexOAuthSessionKey(channelID, "verifier"), flow.Verifier)
	session.Set(codexOAuthSessionKey(channelID, "created_at"), time.Now().Unix())
	_ = session.Save()

	return dto.Ok(dto.CodexOAuthStartData{AuthorizeURL: flow.AuthorizeURL})
}

func CompleteCodexOAuth(c fuego.ContextWithBody[codexOAuthCompleteRequest]) (*dto.Response[dto.CodexOAuthCompleteData], error) {
	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.CodexOAuthCompleteData](err.Error())
	}
	return completeCodexOAuthWithChannelID(dto.GinCtx(c), c.Request().Context(), req.Input, 0)
}

func CompleteCodexOAuthForChannel(c fuego.ContextWithBody[codexOAuthCompleteRequest]) (*dto.Response[dto.CodexOAuthCompleteData], error) {
	channelID, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[dto.CodexOAuthCompleteData](fmt.Sprintf("invalid channel id: %v", err))
	}
	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.CodexOAuthCompleteData](err.Error())
	}
	return completeCodexOAuthWithChannelID(dto.GinCtx(c), c.Request().Context(), req.Input, channelID)
}

func completeCodexOAuthWithChannelID(ginCtx *gin.Context, reqCtx context.Context, input string, channelID int) (*dto.Response[dto.CodexOAuthCompleteData], error) {
	code, state, err := parseCodexAuthorizationInput(input)
	if err != nil {
		common.SysError("failed to parse codex authorization input: " + err.Error())
		return dto.Fail[dto.CodexOAuthCompleteData]("解析授权信息失败，请检查输入格式")
	}
	if strings.TrimSpace(code) == "" {
		return dto.Fail[dto.CodexOAuthCompleteData]("missing authorization code")
	}
	if strings.TrimSpace(state) == "" {
		return dto.Fail[dto.CodexOAuthCompleteData]("missing state in input")
	}

	channelProxy := ""
	if channelID > 0 {
		ch, err := model.GetChannelById(channelID, false)
		if err != nil {
			return dto.Fail[dto.CodexOAuthCompleteData](err.Error())
		}
		if ch == nil {
			return dto.Fail[dto.CodexOAuthCompleteData]("channel not found")
		}
		if ch.Type != constant.ChannelTypeCodex {
			return dto.Fail[dto.CodexOAuthCompleteData]("channel type is not Codex")
		}
		channelProxy = ch.GetSetting().Proxy
	}

	session := sessions.Default(ginCtx)
	expectedState, _ := session.Get(codexOAuthSessionKey(channelID, "state")).(string)
	verifier, _ := session.Get(codexOAuthSessionKey(channelID, "verifier")).(string)
	if strings.TrimSpace(expectedState) == "" || strings.TrimSpace(verifier) == "" {
		return dto.Fail[dto.CodexOAuthCompleteData]("oauth flow not started or session expired")
	}
	if state != expectedState {
		return dto.Fail[dto.CodexOAuthCompleteData]("state mismatch")
	}

	ctx, cancel := context.WithTimeout(reqCtx, 15*time.Second)
	defer cancel()

	tokenRes, err := service.ExchangeCodexAuthorizationCodeWithProxy(ctx, code, verifier, channelProxy)
	if err != nil {
		common.SysError("failed to exchange codex authorization code: " + err.Error())
		return dto.Fail[dto.CodexOAuthCompleteData]("授权码交换失败，请重试")
	}

	accountID, ok := service.ExtractCodexAccountIDFromJWT(tokenRes.AccessToken)
	if !ok {
		return dto.Fail[dto.CodexOAuthCompleteData]("failed to extract account_id from access_token")
	}
	email, _ := service.ExtractEmailFromJWT(tokenRes.AccessToken)

	key := codex.OAuthKey{
		AccessToken:  tokenRes.AccessToken,
		RefreshToken: tokenRes.RefreshToken,
		AccountID:    accountID,
		LastRefresh:  time.Now().Format(time.RFC3339),
		Expired:      tokenRes.ExpiresAt.Format(time.RFC3339),
		Email:        email,
		Type:         "codex",
	}
	encoded, err := common.Marshal(key)
	if err != nil {
		return dto.Fail[dto.CodexOAuthCompleteData](err.Error())
	}

	session.Delete(codexOAuthSessionKey(channelID, "state"))
	session.Delete(codexOAuthSessionKey(channelID, "verifier"))
	session.Delete(codexOAuthSessionKey(channelID, "created_at"))
	_ = session.Save()

	if channelID > 0 {
		if err := model.DB.Model(&model.Channel{}).Where("id = ?", channelID).Update("key", string(encoded)).Error; err != nil {
			return dto.Fail[dto.CodexOAuthCompleteData](err.Error())
		}
		model.InitChannelCache()
		service.ResetProxyClientCache()
		return dto.OkMsg("saved", dto.CodexOAuthCompleteData{
			ChannelID:   channelID,
			AccountID:   accountID,
			Email:       email,
			ExpiresAt:   key.Expired,
			LastRefresh: key.LastRefresh,
		})
	}

	return dto.OkMsg("generated", dto.CodexOAuthCompleteData{
		Key:         string(encoded),
		AccountID:   accountID,
		Email:       email,
		ExpiresAt:   key.Expired,
		LastRefresh: key.LastRefresh,
	})
}
