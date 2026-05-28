package controller

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
)

var (
	paddleClientTokenProvisionMu sync.Mutex
	paddleClientTokenHTTPClient  = &http.Client{Timeout: 15 * time.Second}
	paddleClientTokenAPIBase     string
	paddleClientTokenSaveOption  = model.UpdateOption
)

type paddleCreateClientTokenRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type paddleCreateClientTokenResponse struct {
	Data struct {
		ID     string `json:"id"`
		Token  string `json:"token"`
		Status string `json:"status"`
	} `json:"data"`
	Error *paddleAPIError `json:"error,omitempty"`
}

func isPaddleClientTokenMatched(clientToken string) bool {
	clientToken = strings.TrimSpace(clientToken)
	if clientToken == "" {
		return false
	}
	if setting.EffectivePaddleSandbox() {
		return paddleSandboxTokenPattern.MatchString(clientToken)
	}
	return paddleLiveTokenPattern.MatchString(clientToken)
}

func ensurePaddleClientTokenConfigured() bool {
	if isPaddleClientTokenMatched(setting.PaddleClientToken) {
		return true
	}
	if strings.TrimSpace(setting.PaddleClientToken) != "" || !isPaddleAPIKeyConfigured() {
		return false
	}

	paddleClientTokenProvisionMu.Lock()
	defer paddleClientTokenProvisionMu.Unlock()

	if isPaddleClientTokenMatched(setting.PaddleClientToken) {
		return true
	}
	if strings.TrimSpace(setting.PaddleClientToken) != "" {
		return false
	}

	token, err := createPaddleClientToken()
	if err != nil {
		common.SysLog("Paddle client-side token auto-provision failed: " + err.Error())
		return false
	}
	if !isPaddleClientTokenMatched(token) {
		common.SysLog("Paddle client-side token auto-provision returned a token for the wrong environment")
		return false
	}
	if err := paddleClientTokenSaveOption("PaddleClientToken", token); err != nil {
		common.SysLog("Paddle client-side token auto-provision save failed: " + err.Error())
		return false
	}
	return true
}

func createPaddleClientToken() (string, error) {
	payload := paddleCreateClientTokenRequest{
		Name:        "Flatkey wallet checkout",
		Description: "Auto-created client-side token for wallet top-up checkout.",
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, paddleClientTokenCreateURL(), bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(setting.PaddleApiKey))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Paddle-Version", paddleAPIVersion)

	resp, err := paddleClientTokenHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result paddleCreateClientTokenResponse
	if err := common.Unmarshal(respBody, &result); err != nil {
		return "", err
	}
	if resp.StatusCode/100 != 2 {
		if result.Error != nil && result.Error.Detail != "" {
			return "", errors.New(paddleAPIErrorDetail(result.Error))
		}
		return "", fmt.Errorf("Paddle API returned status %d", resp.StatusCode)
	}

	token := strings.TrimSpace(result.Data.Token)
	if token == "" {
		return "", errors.New("Paddle API response is missing client-side token")
	}
	common.SysLog(fmt.Sprintf("Paddle client-side token auto-provisioned token_id=%s status=%s sandbox=%t", strings.TrimSpace(result.Data.ID), strings.TrimSpace(result.Data.Status), setting.EffectivePaddleSandbox()))
	return token, nil
}

func paddleClientTokenCreateURL() string {
	baseURL := strings.TrimRight(paddleClientTokenAPIBase, "/")
	if baseURL == "" {
		baseURL = paddleAPIBaseURL()
	}
	return baseURL + "/client-tokens"
}
