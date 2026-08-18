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
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return Credential{}, fmt.Errorf("grok refresh: token endpoint status %d", resp.StatusCode)
	}
	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return Credential{}, errors.New("grok refresh: invalid token response")
	}
	if strings.TrimSpace(tr.AccessToken) == "" {
		return Credential{}, errors.New("grok refresh: empty access_token in response")
	}

	newCred := Credential{
		Version:      CredentialVersion,
		Type:         CredentialType,
		AccessToken:  tr.AccessToken,
		RefreshToken: firstNonEmpty(tr.RefreshToken, cred.RefreshToken), // 上游可能不轮换 refresh
		TokenType:    firstNonEmpty(tr.TokenType, cred.TokenType),
		ExpiresAt:    r.now() + tr.ExpiresIn,
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
