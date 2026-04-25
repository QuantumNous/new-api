package service

import (
	"errors"
	"github.com/QuantumNous/new-api/i18n"
	"context"
	"io"
	"net/http"
	"strings"
)

func FetchCodexWhamUsage(
	ctx context.Context,
	client *http.Client,
	baseURL string,
	accessToken string,
	accountID string,
) (statusCode int, body []byte, err error) {
	if client == nil {
		return 0, nil, errors.New(i18n.Translate("svc.nil_http_client"))
	}
	bu := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if bu == "" {
		return 0, nil, errors.New(i18n.Translate("svc.empty_baseurl"))
	}
	at := strings.TrimSpace(accessToken)
	aid := strings.TrimSpace(accountID)
	if at == "" {
		return 0, nil, errors.New(i18n.Translate("svc.empty_accesstoken"))
	}
	if aid == "" {
		return 0, nil, errors.New(i18n.Translate("svc.empty_accountid"))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, bu+"/backend-api/wham/usage", nil)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+at)
	req.Header.Set("chatgpt-account-id", aid)
	req.Header.Set("Accept", "application/json")
	if req.Header.Get("originator") == "" {
		req.Header.Set("originator", "codex_cli_rs")
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	return resp.StatusCode, body, nil
}
