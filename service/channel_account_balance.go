package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func ValidateAccountBalanceConfig(config *model.ChannelBalanceConfig) error {
	config.BaseURL = strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	config.AccessToken = strings.TrimSpace(config.AccessToken)
	if !config.Enabled {
		return nil
	}
	u, err := url.Parse(config.BaseURL)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("account site must be an HTTPS URL without credentials, query or fragment")
	}
	if config.UserID <= 0 {
		return errors.New("upstream user ID must be positive")
	}
	if strings.ContainsAny(config.AccessToken, "\r\n") || len(config.AccessToken) > 8192 {
		return errors.New("invalid account access token")
	}
	return nil
}

// FetchAccountBalance reads New API account quota, not the compatibility billing
// endpoint's token limit. Both requests share one bounded deadline.
func FetchAccountBalance(ctx context.Context, channel *model.Channel, config model.ChannelBalanceConfig) (float64, string, error) {
	if err := ValidateAccountBalanceConfig(&config); err != nil {
		return 0, "", err
	}
	if !config.Enabled || config.AccessToken == "" {
		return 0, "", errors.New("account balance query is not configured")
	}
	client, err := GetHttpClientWithProxy(channel.GetSetting().Proxy)
	if err != nil {
		return 0, "", errors.New("failed to initialize account balance connection")
	}
	return fetchAccountBalance(ctx, client, config)
}

func fetchAccountBalance(ctx context.Context, client *http.Client, config model.ChannelBalanceConfig) (float64, string, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	boundedClient := *client
	boundedClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	var status struct {
		Success bool `json:"success"`
		Data    struct {
			QuotaPerUnit *float64 `json:"quota_per_unit"`
			DisplayType  string   `json:"quota_display_type"`
			ExchangeRate *float64 `json:"usd_exchange_rate"`
		} `json:"data"`
	}
	if err := readAccountBalanceJSON(ctx, &boundedClient, config.BaseURL+"/api/status", nil, &status); err != nil {
		return 0, "", err
	}
	if !status.Success || status.Data.QuotaPerUnit == nil || *status.Data.QuotaPerUnit <= 0 || math.IsInf(*status.Data.QuotaPerUnit, 0) || math.IsNaN(*status.Data.QuotaPerUnit) {
		return 0, "", errors.New("upstream quota conversion is missing or invalid")
	}
	currency := status.Data.DisplayType
	multiplier := 1.0
	switch currency {
	case "USD":
	case "CNY":
		if status.Data.ExchangeRate == nil || *status.Data.ExchangeRate <= 0 || math.IsInf(*status.Data.ExchangeRate, 0) || math.IsNaN(*status.Data.ExchangeRate) {
			return 0, "", errors.New("upstream currency conversion is missing or invalid")
		}
		multiplier = *status.Data.ExchangeRate
	default:
		return 0, "", errors.New("account balance currently supports upstream USD or CNY wallets")
	}
	var account struct {
		Success bool `json:"success"`
		Data    struct {
			ID    int      `json:"id"`
			Quota *float64 `json:"quota"`
		} `json:"data"`
	}
	headers := http.Header{}
	headers.Set("Authorization", "Bearer "+config.AccessToken)
	headers.Set("New-Api-User", strconv.Itoa(config.UserID))
	if err := readAccountBalanceJSON(ctx, &boundedClient, config.BaseURL+"/api/user/self", headers, &account); err != nil {
		return 0, "", err
	}
	if !account.Success || account.Data.Quota == nil || account.Data.ID != config.UserID {
		return 0, "", errors.New("upstream account query failed or the user ID does not match")
	}
	balance := *account.Data.Quota / *status.Data.QuotaPerUnit * multiplier
	if math.IsNaN(balance) || math.IsInf(balance, 0) {
		return 0, "", errors.New("upstream account balance is invalid")
	}
	return balance, currency, nil
}

func readAccountBalanceJSON(ctx context.Context, client *http.Client, endpoint string, headers http.Header, output any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return errors.New("invalid account balance request")
	}
	request.Header = headers.Clone()
	if request.Header == nil {
		request.Header = make(http.Header)
	}
	request.Header.Set("Accept", "application/json")
	// Some New API sites reject default library user agents before authentication.
	request.Header.Set("User-Agent", "Mozilla/5.0 (compatible; NewAPI-AccountBalance/1.0)")
	response, err := client.Do(request)
	if err != nil {
		// Do not echo upstream bodies, URLs or transport errors containing secrets.
		return errors.New("account balance request failed or timed out")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("account balance request returned HTTP %d", response.StatusCode)
	}
	const limit = 256 << 10
	body, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil || len(body) > limit {
		return errors.New("account balance response is unreadable or too large")
	}
	if err := common.Unmarshal(body, output); err != nil {
		return errors.New("account balance response is not valid JSON")
	}
	return nil
}
