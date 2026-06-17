package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
)

// ConsumeCodexResetCredit redeems one rate-limit reset credit for a Codex
// account by calling the upstream consume endpoint. The caller owns token
// refresh on 401/403; this function performs a single request.
func ConsumeCodexResetCredit(
	ctx context.Context,
	client *http.Client,
	baseURL string,
	accessToken string,
	accountID string,
) (statusCode int, body []byte, err error) {
	if client == nil {
		return 0, nil, fmt.Errorf("nil http client")
	}
	bu := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if bu == "" {
		return 0, nil, fmt.Errorf("empty baseURL")
	}
	at := strings.TrimSpace(accessToken)
	aid := strings.TrimSpace(accountID)
	if at == "" {
		return 0, nil, fmt.Errorf("empty accessToken")
	}
	if aid == "" {
		return 0, nil, fmt.Errorf("empty accountID")
	}

	// redeem_request_id MUST be a canonical hyphenated UUID-v4 (8-4-4-4-12), matching
	// the sub2api reference. Do NOT use common.GetUUID(), which strips dashes and would
	// yield a 32-char hex string the upstream may reject.
	payload, err := common.Marshal(map[string]string{"redeem_request_id": uuid.NewString()})
	if err != nil {
		return 0, nil, err
	}

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost,
		bu+"/backend-api/wham/rate-limit-reset-credits/consume",
		bytes.NewReader(payload),
	)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+at)
	req.Header.Set("chatgpt-account-id", aid)
	req.Header.Set("content-type", "application/json")
	req.Header.Set("originator", "Codex Desktop")
	req.Header.Set("oai-language", "zh-CN")
	req.Header.Set("accept", "application/json")
	req.Header.Set("sec-fetch-site", "none")
	req.Header.Set("sec-fetch-mode", "no-cors")
	req.Header.Set("sec-fetch-dest", "empty")
	req.Header.Set("priority", "u=4, i")

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
