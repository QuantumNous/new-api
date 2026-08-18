package groksubscription

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// 授权码 / 刷新两种 grant 的固定值（设计 §7）。
const (
	GrantTypeAuthorizationCode = "authorization_code"
	GrantTypeRefreshToken      = "refresh_token"
)

// GrantRejectedError 表示 token endpoint 拒绝了本次授权（OAuth 错误类别，如 invalid_grant）。
// Code 只允许 [a-z_]{1,32} 白名单字符，绝不携带上游 response body 原文；
// 调用方可用 errors.As 识别并映射为 needs_reauth 状态。
type GrantRejectedError struct {
	Code string
}

func (e *GrantRejectedError) Error() string {
	if e.Code == "" {
		return "grok auth: token endpoint rejected grant"
	}
	return "grok auth: token endpoint rejected grant (" + e.Code + ")"
}

// grantErrorCodePattern 限定 error code 只能是 OAuth 词汇表形状（小写字母+下划线），
// 防止上游把任意字符串（可能含敏感内容）借道 error 字段进日志。
var grantErrorCodePattern = regexp.MustCompile(`^[a-z_]{1,32}$`)

// ExchangeToken 与 auth.x.ai token endpoint 交换凭证：
//   - authorization_code：需 code + codeVerifier（PKCE）+ redirectURI；
//   - refresh_token：需 refreshToken（import 场景，渠道尚无凭证）。
//
// 与 Refresher.Refresh 的分工：Refresh 从 store 按渠道取既有凭证刷新（Task 8），
// ExchangeToken 处理"手里只有 code 或裸 refresh token"的首次交换（Task 18 complete/import）。
// 解析语义与 Refresh 保持一致：非 200 不 echo body（只带脱敏类别码）、access_token 必须非空、
// refresh_token 上游不轮换时保留输入值、ExpiresAt = now + expires_in（unix 秒）。
func ExchangeToken(ctx context.Context, doer HTTPDoer, grantType, code, codeVerifier, refreshToken, redirectURI string) (Credential, error) {
	if doer == nil {
		return Credential{}, errors.New("grok auth: http doer is required")
	}
	switch grantType {
	case GrantTypeAuthorizationCode:
		if code == "" || codeVerifier == "" || redirectURI == "" {
			return Credential{}, errors.New("grok auth: authorization_code grant requires code, code_verifier and redirect_uri")
		}
	case GrantTypeRefreshToken:
		if refreshToken == "" {
			return Credential{}, errors.New("grok auth: refresh_token grant requires refresh_token")
		}
	default:
		return Credential{}, errors.New("grok auth: unsupported grant type")
	}

	form := url.Values{}
	form.Set("grant_type", grantType)
	form.Set("client_id", OAuthClientID)
	if grantType == GrantTypeAuthorizationCode {
		form.Set("code", code)
		form.Set("code_verifier", codeVerifier)
		form.Set("redirect_uri", redirectURI)
	} else {
		form.Set("refresh_token", refreshToken)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, OAuthToken, strings.NewReader(form.Encode()))
	if err != nil {
		return Credential{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := doer.Do(req)
	if err != nil {
		// net/http 的传输错误不含 form body（秘密在 body 里），可安全携带；仍不 echo 任何响应体。
		return Credential{}, fmt.Errorf("grok auth: token request failed: %w", err)
	}
	defer resp.Body.Close()
	// 与 Refresh 相同：body 只参与成功路径判定，读取异常由后续解析失败兜住（fail-closed）。
	body, _ := io.ReadAll(io.LimitReader(resp.Body, maxTokenResponseBytes))
	if resp.StatusCode != http.StatusOK {
		return Credential{}, &GrantRejectedError{Code: sanitizeGrantErrorCode(body)}
	}
	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return Credential{}, errors.New("grok auth: invalid token response")
	}
	if strings.TrimSpace(tr.AccessToken) == "" {
		return Credential{}, errors.New("grok auth: empty access_token in response")
	}

	refresh := tr.RefreshToken
	if refresh == "" && grantType == GrantTypeRefreshToken {
		refresh = refreshToken // 上游可能不轮换 refresh（RFC 6749 §6），保留输入值
	}
	return Credential{
		Version:      CredentialVersion,
		Type:         CredentialType,
		AccessToken:  tr.AccessToken,
		RefreshToken: refresh,
		TokenType:    firstNonEmpty(tr.TokenType, "Bearer"),
		ExpiresAt:    time.Now().Unix() + tr.ExpiresIn,
	}, nil
}

// sanitizeGrantErrorCode 从非 200 body 中提取 OAuth 错误类别码；解析失败或形状非法返回空串。
// 只回类别码，error_description 等其余字段一律丢弃（脱敏铁律）。
func sanitizeGrantErrorCode(body []byte) string {
	var parsed struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return ""
	}
	code := strings.TrimSpace(parsed.Error)
	if !grantErrorCodePattern.MatchString(code) {
		return ""
	}
	return code
}
