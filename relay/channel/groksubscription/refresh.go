package groksubscription

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

var (
	ErrNotRefreshable  = errors.New("grok refresh: credential has no refresh_token")
	ErrRefreshConflict = errors.New("grok refresh: revision CAS conflict")
)

type RefreshHTTPStatusError struct {
	StatusCode int
}

func (e RefreshHTTPStatusError) Error() string {
	return fmt.Sprintf("grok refresh: token endpoint status %d", e.StatusCode)
}

// maxTokenResponseBytes 限制读取上游响应体，防超大响应。
const maxTokenResponseBytes = 1 << 20

// HTTPDoer 便于测试注入。
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

// CredentialStore 抽象 Channel.Key 的读取与 revision CAS 写回。
type CredentialStore interface {
	Load(ctx context.Context, channelID int) (key string, revision int, err error)
	CompareAndSwap(ctx context.Context, channelID, expectedRevision int, newKey string) (bool, error)
}

// Refresher 执行 token 刷新 + 原子写回。
type Refresher struct {
	store CredentialStore
	doer  HTTPDoer
	now   func() int64
}

func NewRefresher(store CredentialStore, doer HTTPDoer, now func() int64) *Refresher {
	return &Refresher{store: store, doer: doer, now: now}
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

// Refresh 刷新指定渠道的凭证并 CAS 写回，返回新凭证。
func (r *Refresher) Refresh(ctx context.Context, channelID int) (Credential, error) {
	rawKey, revision, err := r.store.Load(ctx, channelID)
	if err != nil {
		return Credential{}, err
	}
	cred, err := ParseCredential(rawKey)
	if err != nil {
		return Credential{}, err
	}
	if !cred.IsRefreshable() {
		return Credential{}, ErrNotRefreshable
	}

	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", cred.RefreshToken)
	form.Set("client_id", OAuthClientID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, OAuthToken, strings.NewReader(form.Encode()))
	if err != nil {
		return Credential{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := r.doer.Do(req)
	if err != nil {
		return Credential{}, err
	}
	defer resp.Body.Close()
	// 忽略 ReadAll error 是有意的：status!=200 时 body 不参与判定（error 只带状态码）；
	// status==200 时读取异常会被后续 json.Unmarshal 失败或空 access_token 检查兜住（均 fail-closed）。
	body, _ := io.ReadAll(io.LimitReader(resp.Body, maxTokenResponseBytes))
	if resp.StatusCode != http.StatusOK {
		return Credential{}, RefreshHTTPStatusError{StatusCode: resp.StatusCode}
	}
	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return Credential{}, errors.New("grok refresh: invalid token response")
	}
	if strings.TrimSpace(tr.AccessToken) == "" {
		return Credential{}, errors.New("grok refresh: empty access_token in response")
	}
	// fail-closed：expires_in<=0（含缺省 0）会算出 ExpiresAt<=now 的立即过期凭证，
	// ParseCredential 读回强制 ExpiresAt>0，写入即自败并可能触发重刷循环——绝不落库。
	if tr.ExpiresIn <= 0 {
		return Credential{}, errors.New("grok refresh: non-positive expires_in")
	}

	newCred := Credential{
		Version:      CredentialVersion,
		Type:         CredentialType,
		AccessToken:  tr.AccessToken,
		RefreshToken: firstNonEmpty(tr.RefreshToken, cred.RefreshToken), // 上游可能不轮换 refresh
		TokenType:    firstNonEmpty(tr.TokenType, cred.TokenType),
		// 单位约定：now() 返回 unix 秒，tr.ExpiresIn 为上游给的有效期秒数，故 ExpiresAt 为 unix 秒。
		ExpiresAt: r.now() + tr.ExpiresIn,
	}
	serialized, err := newCred.Serialize()
	if err != nil {
		return Credential{}, err
	}
	ok, err := r.store.CompareAndSwap(ctx, channelID, revision, serialized)
	if err != nil {
		return Credential{}, err
	}
	if !ok {
		return Credential{}, ErrRefreshConflict
	}
	return newCred, nil
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}
