package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
)

type newAPITokenUsageResponse struct {
	Code bool                  `json:"code"`
	Data *newAPITokenUsageData `json:"data"`
}

type newAPITokenUsageData struct {
	TotalAvailable *decimal.Decimal `json:"total_available"`
	UnlimitedQuota bool             `json:"unlimited_quota"`
	ExpiresAt      int64            `json:"expires_at"`
}

type newAPIStatusResponse struct {
	Success bool              `json:"success"`
	Data    *newAPIStatusData `json:"data"`
}

type newAPIStatusData struct {
	QuotaPerUnit               *decimal.Decimal `json:"quota_per_unit"`
	QuotaDisplayType           string           `json:"quota_display_type"`
	USDExchangeRate            *decimal.Decimal `json:"usd_exchange_rate"`
	CustomCurrencySymbol       string           `json:"custom_currency_symbol"`
	CustomCurrencyExchangeRate *decimal.Decimal `json:"custom_currency_exchange_rate"`
}

func updateChannelNewAPIBalance(channel *model.Channel) (*model.ChannelBalanceInfo, *float64, error) {
	usageBody, err := getNewAPIChannelResponse(channel, "/api/usage/token/")
	if err != nil {
		return nil, nil, err
	}
	var usage newAPITokenUsageResponse
	if err := common.Unmarshal(usageBody, &usage); err != nil {
		return nil, nil, fmt.Errorf("invalid New API token usage response: %w", err)
	}
	if !usage.Code || usage.Data == nil || usage.Data.TotalAvailable == nil {
		return nil, nil, errors.New("New API token usage response is invalid")
	}
	if usage.Data.ExpiresAt > 0 && usage.Data.ExpiresAt < time.Now().Unix() {
		return nil, nil, errors.New("New API token is expired")
	}

	var status *newAPIStatusData
	if statusBody, statusErr := getNewAPIChannelResponse(channel, "/api/status"); statusErr == nil {
		var parsed newAPIStatusResponse
		if common.Unmarshal(statusBody, &parsed) == nil && parsed.Success && parsed.Data != nil {
			status = parsed.Data
		}
	}
	info, legacyBalance := normalizeNewAPIBalance(*usage.Data.TotalAvailable, usage.Data.UnlimitedQuota, status)
	if err := channel.UpdateBalanceInfo(info, legacyBalance); err != nil {
		return nil, nil, err
	}
	return &info, legacyBalance, nil
}

func getNewAPIChannelResponse(channel *model.Channel, path string) ([]byte, error) {
	baseURL, err := url.Parse(strings.TrimSpace(channel.GetBaseURL()))
	if err != nil || (baseURL.Scheme != "http" && baseURL.Scheme != "https") || baseURL.Host == "" || baseURL.User != nil || baseURL.RawQuery != "" || baseURL.Fragment != "" {
		return nil, errors.New("invalid New API channel base URL")
	}
	baseURL.Path = strings.TrimRight(baseURL.Path, "/") + path
	baseURL.RawPath = ""
	return GetResponseBody(http.MethodGet, baseURL.String(), channel, GetAuthHeader(channel.Key))
}

func normalizeNewAPIBalance(remaining decimal.Decimal, unlimited bool, status *newAPIStatusData) (model.ChannelBalanceInfo, *float64) {
	info := model.ChannelBalanceInfo{
		Remaining:   remaining.String(),
		Unit:        model.ChannelBalanceUnitCredits,
		DisplayUnit: "credits",
		Unlimited:   unlimited,
		UpdatedAt:   common.GetTimestamp(),
	}
	if unlimited {
		info.Remaining = ""
	}
	if status == nil || status.QuotaPerUnit == nil || !status.QuotaPerUnit.IsPositive() {
		return info, nil
	}

	convert := func(multiplier decimal.Decimal) decimal.Decimal {
		return remaining.Div(*status.QuotaPerUnit).Mul(multiplier)
	}
	var legacyBalance *float64
	switch strings.ToUpper(status.QuotaDisplayType) {
	case "USD":
		amount := convert(decimal.NewFromInt(1))
		info.Unit, info.Currency, info.DisplayUnit = model.ChannelBalanceUnitMoney, "USD", "$"
		if !unlimited {
			info.Remaining = amount.String()
			value := amount.InexactFloat64()
			legacyBalance = &value
		}
	case "CNY":
		if status.USDExchangeRate != nil && status.USDExchangeRate.IsPositive() {
			amount := convert(*status.USDExchangeRate)
			info.Unit, info.Currency, info.DisplayUnit = model.ChannelBalanceUnitMoney, "CNY", "¥"
			if !unlimited {
				info.Remaining = amount.String()
			}
		}
	case "TOKENS":
		info.Unit, info.DisplayUnit = model.ChannelBalanceUnitTokens, "tokens"
	case "CUSTOM":
		if status.CustomCurrencyExchangeRate != nil && status.CustomCurrencyExchangeRate.IsPositive() {
			amount := convert(*status.CustomCurrencyExchangeRate)
			info.Unit, info.Currency = model.ChannelBalanceUnitMoney, "CUSTOM"
			info.DisplayUnit = strings.TrimSpace(status.CustomCurrencySymbol)
			if info.DisplayUnit == "" {
				info.DisplayUnit = "¤"
			}
			if !unlimited {
				info.Remaining = amount.String()
			}
		}
	}
	return info, legacyBalance
}

func newAPIBalanceExhausted(info *model.ChannelBalanceInfo) bool {
	if info == nil || info.Unlimited || info.Remaining == "" {
		return false
	}
	remaining, err := decimal.NewFromString(info.Remaining)
	return err == nil && !remaining.IsPositive()
}
