package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/advancedcustom"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"

	"github.com/gin-gonic/gin"
)

// https://github.com/songquanpeng/one-api/issues/79

type OpenAISubscriptionResponse struct {
	Object             string  `json:"object"`
	HasPaymentMethod   bool    `json:"has_payment_method"`
	SoftLimitUSD       float64 `json:"soft_limit_usd"`
	HardLimitUSD       float64 `json:"hard_limit_usd"`
	SystemHardLimitUSD float64 `json:"system_hard_limit_usd"`
	AccessUntil        int64   `json:"access_until"`
}

type OpenAIUsageDailyCost struct {
	Timestamp float64 `json:"timestamp"`
	LineItems []struct {
		Name string  `json:"name"`
		Cost float64 `json:"cost"`
	}
}

type OpenAICreditGrants struct {
	Object         string  `json:"object"`
	TotalGranted   float64 `json:"total_granted"`
	TotalUsed      float64 `json:"total_used"`
	TotalAvailable float64 `json:"total_available"`
}

const maxAdvancedCustomBalanceResponseBytes = 256 << 10

type channelBalanceResult struct {
	Balance     float64
	RawResponse string
	// Keys holds the per-key results of a multi-key balance query. It stays
	// empty for single-key channels.
	Keys []channelKeyBalance
	// Partial is true when at least one enabled key did not report a balance,
	// so Balance only covers the keys that did.
	Partial bool
}

// channelKeyBalance is one key's result inside a multi-key balance query. Only a
// preview of the key leaves the backend, truncated to the first 10 characters
// exactly like the multi-key management endpoint, so a key of 10 characters or
// fewer is still shown in full.
type channelKeyBalance struct {
	Index      int      `json:"index"`
	KeyPreview string   `json:"key_preview"`
	Balance    *float64 `json:"balance,omitempty"`
	Error      string   `json:"error,omitempty"`
}

// channelKeyBalanceValue is the result of querying the upstream with one key.
type channelKeyBalanceValue struct {
	// Balance is what this key can spend on its own.
	Balance float64
	// AccountCap is the upstream's shared ceiling over the same dimension, for
	// example the New API owner quota. Every key of one account reports it, so
	// it caps the sum instead of being summed.
	AccountCap *float64
	// AccountLevel marks a value that belongs to the upstream account rather
	// than to the key, so it is counted once instead of being summed.
	AccountLevel bool
}

type OpenAIUsageResponse struct {
	Object string `json:"object"`
	//DailyCosts []OpenAIUsageDailyCost `json:"daily_costs"`
	TotalUsage float64 `json:"total_usage"` // unit: 0.01 dollar
}

type OpenAISBUsageResponse struct {
	Msg  string `json:"msg"`
	Data *struct {
		Credit string `json:"credit"`
	} `json:"data"`
}

type AIProxyUserOverviewResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	ErrorCode int    `json:"error_code"`
	Data      struct {
		TotalPoints float64 `json:"totalPoints"`
	} `json:"data"`
}

type API2GPTUsageResponse struct {
	Object         string  `json:"object"`
	TotalGranted   float64 `json:"total_granted"`
	TotalUsed      float64 `json:"total_used"`
	TotalRemaining float64 `json:"total_remaining"`
}

type APGC2DGPTUsageResponse struct {
	//Grants         interface{} `json:"grants"`
	Object         string  `json:"object"`
	TotalAvailable float64 `json:"total_available"`
	TotalGranted   float64 `json:"total_granted"`
	TotalUsed      float64 `json:"total_used"`
}

type SiliconFlowUsageResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Status  bool   `json:"status"`
	Data    struct {
		ID            string `json:"id"`
		Name          string `json:"name"`
		Image         string `json:"image"`
		Email         string `json:"email"`
		IsAdmin       bool   `json:"isAdmin"`
		Balance       string `json:"balance"`
		Status        string `json:"status"`
		Introduction  string `json:"introduction"`
		Role          string `json:"role"`
		ChargeBalance string `json:"chargeBalance"`
		TotalBalance  string `json:"totalBalance"`
		Category      string `json:"category"`
	} `json:"data"`
}

type DeepSeekUsageResponse struct {
	IsAvailable  bool `json:"is_available"`
	BalanceInfos []struct {
		Currency        string `json:"currency"`
		TotalBalance    string `json:"total_balance"`
		GrantedBalance  string `json:"granted_balance"`
		ToppedUpBalance string `json:"topped_up_balance"`
	} `json:"balance_infos"`
}

type OpenRouterCreditResponse struct {
	Data struct {
		TotalCredits float64 `json:"total_credits"`
		TotalUsage   float64 `json:"total_usage"`
	} `json:"data"`
}

// GetAuthHeader get auth header
func GetAuthHeader(token string) http.Header {
	h := http.Header{}
	h.Add("Authorization", fmt.Sprintf("Bearer %s", token))
	return h
}

// GetClaudeAuthHeader get claude auth header
func GetClaudeAuthHeader(token string) http.Header {
	h := http.Header{}
	h.Add("x-api-key", token)
	h.Add("anthropic-version", "2023-06-01")
	return h
}

func GetResponseBody(method, url string, channel *model.Channel, headers http.Header) ([]byte, error) {
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}
	for k := range headers {
		req.Header.Add(k, headers.Get(k))
	}
	setting := channel.GetSetting()
	client, err := service.GetHttpClientWithProxySettings(setting.Proxy, setting)
	if err != nil {
		return nil, err
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status code: %d", res.StatusCode)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	err = res.Body.Close()
	if err != nil {
		return nil, err
	}
	return body, nil
}

func updateChannelCloseAIBalance(channel *model.Channel) (float64, error) {
	url := fmt.Sprintf("%s/dashboard/billing/credit_grants", channel.GetBaseURL())
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(channel.Key))

	if err != nil {
		return 0, err
	}
	response := OpenAICreditGrants{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	channel.UpdateBalance(response.TotalAvailable)
	return response.TotalAvailable, nil
}

func updateChannelOpenAISBBalance(channel *model.Channel) (float64, error) {
	url := fmt.Sprintf("https://api.openai-sb.com/sb-api/user/status?api_key=%s", channel.Key)
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}
	response := OpenAISBUsageResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	if response.Data == nil {
		return 0, errors.New(response.Msg)
	}
	balance, err := strconv.ParseFloat(response.Data.Credit, 64)
	if err != nil {
		return 0, err
	}
	channel.UpdateBalance(balance)
	return balance, nil
}

func fetchChannelAIProxyBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	url := "https://aiproxy.io/api/report/getUserOverview"
	headers := http.Header{}
	headers.Add("Api-Key", key)
	body, err := GetResponseBody("GET", url, channel, headers)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	response := AIProxyUserOverviewResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	if !response.Success {
		return channelKeyBalanceValue{}, fmt.Errorf("code: %d, message: %s", response.ErrorCode, response.Message)
	}
	return channelKeyBalanceValue{Balance: response.Data.TotalPoints}, nil
}

func fetchChannelAPI2GPTBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	url := "https://api.api2gpt.com/dashboard/billing/credit_grants"
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	response := API2GPTUsageResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	return channelKeyBalanceValue{Balance: response.TotalRemaining}, nil
}

func fetchChannelSiliconFlowBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	url := "https://api.siliconflow.cn/v1/user/info"
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	response := SiliconFlowUsageResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	if response.Code != 20000 {
		return channelKeyBalanceValue{}, fmt.Errorf("code: %d, message: %s", response.Code, response.Message)
	}
	balance, err := strconv.ParseFloat(response.Data.TotalBalance, 64)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	return channelKeyBalanceValue{Balance: balance}, nil
}

func getDeepSeekBalanceUSD(response DeepSeekUsageResponse, usdExchangeRate float64) (float64, error) {
	var usdBalance *string
	var cnyBalance *string

	for i := range response.BalanceInfos {
		balanceInfo := &response.BalanceInfos[i]
		switch balanceInfo.Currency {
		case "USD":
			if usdBalance == nil {
				usdBalance = &balanceInfo.TotalBalance
			}
		case "CNY":
			if cnyBalance == nil {
				cnyBalance = &balanceInfo.TotalBalance
			}
		}
	}

	if usdBalance != nil {
		balance, err := strconv.ParseFloat(*usdBalance, 64)
		if err != nil {
			return 0, err
		}
		if math.IsNaN(balance) || math.IsInf(balance, 0) {
			return 0, errors.New("USD balance must be finite")
		}
		if balance < 0 {
			return 0, errors.New("USD balance must be non-negative")
		}
		return balance, nil
	}
	if cnyBalance == nil {
		return 0, errors.New("currency USD or CNY not found")
	}
	if math.IsNaN(usdExchangeRate) || math.IsInf(usdExchangeRate, 0) {
		return 0, errors.New("USD exchange rate must be finite")
	}
	if usdExchangeRate <= 0 {
		return 0, errors.New("USD exchange rate must be greater than zero")
	}

	balanceCNY, err := strconv.ParseFloat(*cnyBalance, 64)
	if err != nil {
		return 0, err
	}
	if math.IsNaN(balanceCNY) || math.IsInf(balanceCNY, 0) {
		return 0, errors.New("CNY balance must be finite")
	}
	if balanceCNY < 0 {
		return 0, errors.New("CNY balance must be non-negative")
	}
	balanceUSD := decimal.NewFromFloat(balanceCNY).Div(decimal.NewFromFloat(usdExchangeRate)).InexactFloat64()
	if math.IsNaN(balanceUSD) || math.IsInf(balanceUSD, 0) {
		return 0, errors.New("converted USD balance must be finite")
	}
	if balanceUSD < 0 {
		return 0, errors.New("converted USD balance must be non-negative")
	}
	return balanceUSD, nil
}

func fetchChannelDeepSeekBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	url := "https://api.deepseek.com/user/balance"
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	response := DeepSeekUsageResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	balance, err := getDeepSeekBalanceUSD(response, operation_setting.USDExchangeRate)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	return channelKeyBalanceValue{Balance: balance}, nil
}

func fetchChannelAIGC2DBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	url := "https://api.aigc2d.com/dashboard/billing/credit_grants"
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	response := APGC2DGPTUsageResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	return channelKeyBalanceValue{Balance: response.TotalAvailable}, nil
}

func fetchChannelOpenRouterBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	url := "https://openrouter.ai/api/v1/credits"
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	response := OpenRouterCreditResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	return channelKeyBalanceValue{Balance: response.Data.TotalCredits - response.Data.TotalUsage}, nil
}

func fetchChannelMoonshotBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	url := "https://api.moonshot.cn/v1/users/me/balance"
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}

	type MoonshotBalanceData struct {
		AvailableBalance float64 `json:"available_balance"`
		VoucherBalance   float64 `json:"voucher_balance"`
		CashBalance      float64 `json:"cash_balance"`
	}

	type MoonshotBalanceResponse struct {
		Code   int                 `json:"code"`
		Data   MoonshotBalanceData `json:"data"`
		Scode  string              `json:"scode"`
		Status bool                `json:"status"`
	}

	response := MoonshotBalanceResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	if !response.Status || response.Code != 0 {
		return channelKeyBalanceValue{}, fmt.Errorf("failed to update moonshot balance, status: %v, code: %d, scode: %s", response.Status, response.Code, response.Scode)
	}
	availableBalanceCny := response.Data.AvailableBalance
	availableBalanceUsd := decimal.NewFromFloat(availableBalanceCny).Div(decimal.NewFromFloat(operation_setting.Price)).InexactFloat64()
	return channelKeyBalanceValue{Balance: availableBalanceUsd}, nil
}

func fetchChannelSub2APIBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	baseURL := channel.GetBaseURL()
	if baseURL == "" {
		return channelKeyBalanceValue{}, errors.New("Sub2API channel is missing base_url")
	}
	url := fmt.Sprintf("%s/v1/usage", strings.TrimRight(baseURL, "/"))
	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}

	type sub2apiUsageResponse struct {
		Balance      *float64 `json:"balance"`
		Remaining    *float64 `json:"remaining"`
		IsValid      *bool    `json:"isValid"`
		Subscription *struct {
			DailyLimitUSD   *float64 `json:"daily_limit_usd"`
			WeeklyLimitUSD  *float64 `json:"weekly_limit_usd"`
			MonthlyLimitUSD *float64 `json:"monthly_limit_usd"`
		} `json:"subscription"`
	}
	usage := sub2apiUsageResponse{}
	if err := common.Unmarshal(body, &usage); err != nil {
		return channelKeyBalanceValue{}, err
	}
	if usage.IsValid != nil && !*usage.IsValid {
		return channelKeyBalanceValue{}, errors.New("Sub2API key is invalid (isValid=false)")
	}

	// remaining comes from this key's own subscription limits, while balance is
	// the account wallet shared by every key of the account, so a wallet value
	// must not be added up per key.
	balance := usage.Remaining
	accountLevel := false
	if balance == nil {
		balance = usage.Balance
		accountLevel = true
	}
	if balance == nil {
		return channelKeyBalanceValue{}, errors.New("Sub2API /v1/usage response is missing remaining and balance fields (the key may belong to a subscription group without an available balance)")
	}
	// Sub2API reports remaining=-1 for a subscription group with no daily, weekly,
	// or monthly limit. A wallet balance can legitimately be negative, so detect
	// the unlimited case from the subscription limits rather than the value.
	subscription := usage.Subscription
	if subscription != nil && subscription.DailyLimitUSD == nil && subscription.WeeklyLimitUSD == nil && subscription.MonthlyLimitUSD == nil {
		return channelKeyBalanceValue{}, errors.New("Sub2API /v1/usage reports an unlimited subscription without a finite balance")
	}
	return channelKeyBalanceValue{Balance: *balance, AccountLevel: accountLevel}, nil
}

// fetchChannelNewAPIBalance reads the upstream key's remaining quota. The key
// quota and the owner quota are returned separately: the owner quota is shared
// by every key of the upstream account, so a multi-key query caps the sum with
// it instead of adding it up. Quota converts to USD with quota_per_unit.
// fetchChannelNewAPIQuotaPerUnit reads the upstream's quota_per_unit, which
// describes the channel rather than one key, so a multi-key query resolves it
// once instead of once per key.
func fetchChannelNewAPIQuotaPerUnit(channel *model.Channel) (float64, error) {
	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	if baseURL == "" {
		return 0, errors.New("New API channel is missing base_url")
	}
	body, err := GetResponseBody("GET", baseURL+"/api/status", channel, nil)
	if err != nil {
		return 0, err
	}
	var status struct {
		Data struct {
			QuotaPerUnit float64 `json:"quota_per_unit"`
		} `json:"data"`
	}
	if err := common.Unmarshal(body, &status); err != nil {
		return 0, err
	}
	if status.Data.QuotaPerUnit <= 0 {
		return 0, errors.New("New API /api/status response is missing quota_per_unit")
	}
	return status.Data.QuotaPerUnit, nil
}

// fetchChannelNewAPIBalanceForKey reads the upstream key's remaining quota. The
// key quota and the owner quota are returned separately: the owner quota is
// shared by every key of the upstream account, so a multi-key query caps the sum
// with it instead of adding it up.
func fetchChannelNewAPIBalanceForKey(channel *model.Channel, key string, quotaPerUnit float64) (channelKeyBalanceValue, error) {
	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	if baseURL == "" {
		return channelKeyBalanceValue{}, errors.New("New API channel is missing base_url")
	}
	body, err := GetResponseBody("GET", baseURL+"/api/usage/token/", channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	var usage struct {
		Code    bool   `json:"code"`
		Message string `json:"message"`
		Data    struct {
			TotalAvailable float64 `json:"total_available"`
			UnlimitedQuota bool    `json:"unlimited_quota"`
			UserQuota      *struct {
				TotalAvailable float64 `json:"total_available"`
			} `json:"user_quota"`
		} `json:"data"`
	}
	if err := common.Unmarshal(body, &usage); err != nil {
		return channelKeyBalanceValue{}, err
	}
	if !usage.Code {
		return channelKeyBalanceValue{}, fmt.Errorf("New API usage query failed: %s", usage.Message)
	}
	value := channelKeyBalanceValue{Balance: usage.Data.TotalAvailable}
	if usage.Data.UnlimitedQuota {
		value.Balance = math.Inf(1)
	}
	if userQuota := usage.Data.UserQuota; userQuota != nil {
		accountCap := userQuota.TotalAvailable
		value.AccountCap = &accountCap
	}
	if math.IsInf(value.Balance, 1) && value.AccountCap == nil {
		return channelKeyBalanceValue{}, common.NewMessage(`The upstream key has unlimited quota. Turn on "Allow querying user quota" for this key on the upstream to see the real balance.`)
	}
	value.Balance /= quotaPerUnit
	if value.AccountCap != nil {
		accountCap := *value.AccountCap / quotaPerUnit
		value.AccountCap = &accountCap
	}
	return value, nil
}

func fetchChannelNewAPIBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	quotaPerUnit, err := fetchChannelNewAPIQuotaPerUnit(channel)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	return fetchChannelNewAPIBalanceForKey(channel, key, quotaPerUnit)
}

func fetchAdvancedCustomBalance(channel *model.Channel, key string) (channelBalanceResult, error) {
	key = strings.TrimSpace(key)
	info := &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatOpenAI,
		RelayMode:      relayconstant.RelayModeUnknown,
		RequestURLPath: dto.AdvancedCustomBalancePath,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:          constant.ChannelTypeAdvancedCustom,
			ChannelBaseUrl:       channel.GetBaseURL(),
			ApiKey:               key,
			ChannelOtherSettings: channel.GetOtherSettings(),
		},
	}
	requestURL, headers, err := (&advancedcustom.Adaptor{}).BuildBalanceRequest(info)
	if err != nil {
		return channelBalanceResult{}, sanitizeFetchModelsError(err, key)
	}
	if err := applyFetchModelsHeaderOverrides(channel, key, headers); err != nil {
		return channelBalanceResult{}, sanitizeFetchModelsError(err, key)
	}

	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return channelBalanceResult{}, sanitizeFetchModelsError(err, key)
	}
	for name, values := range headers {
		for _, value := range values {
			request.Header.Add(name, value)
		}
		if strings.EqualFold(name, "Host") {
			request.Host = headers.Get(name)
		}
	}
	setting := channel.GetSetting()
	client, err := service.GetHttpClientWithProxySettings(setting.Proxy, setting)
	if err != nil {
		return channelBalanceResult{}, sanitizeFetchModelsError(err, key)
	}
	response, err := client.Do(request)
	if err != nil {
		return channelBalanceResult{}, sanitizeAdvancedCustomRequestError(err, key, requestURL)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return channelBalanceResult{}, fmt.Errorf("status code: %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxAdvancedCustomBalanceResponseBytes+1))
	if err != nil {
		return channelBalanceResult{}, sanitizeAdvancedCustomRequestError(err, key, requestURL)
	}
	if len(body) > maxAdvancedCustomBalanceResponseBytes {
		return channelBalanceResult{}, fmt.Errorf("balance response exceeds %d bytes", maxAdvancedCustomBalanceResponseBytes)
	}

	var validated json.RawMessage
	if err := common.Unmarshal(body, &validated); err != nil {
		return channelBalanceResult{}, fmt.Errorf("invalid balance JSON response: %w", err)
	}
	if common.GetJsonType(validated) == "object" {
		var creditSummary struct {
			Object         string          `json:"object"`
			TotalAvailable json.RawMessage `json:"total_available"`
		}
		if err := common.Unmarshal(body, &creditSummary); err != nil {
			return channelBalanceResult{}, fmt.Errorf("invalid balance JSON response: %w", err)
		}
		if creditSummary.Object == "credit_summary" &&
			common.GetJsonType(creditSummary.TotalAvailable) == "number" {
			var balance float64
			if err := common.Unmarshal(creditSummary.TotalAvailable, &balance); err == nil &&
				balance >= 0 &&
				!math.IsNaN(balance) &&
				!math.IsInf(balance, 0) {
				return channelBalanceResult{Balance: balance}, nil
			}
		}
	}

	formatted, err := common.IndentJson(body)
	if err != nil {
		return channelBalanceResult{}, fmt.Errorf("invalid balance JSON response: %w", err)
	}
	return channelBalanceResult{RawResponse: string(formatted)}, nil
}

func updateChannelBalance(channel *model.Channel) (channelBalanceResult, error) {
	if channel.ChannelInfo.IsMultiKey {
		return aggregateMultiKeyChannelBalance(channel)
	}
	if channel.Type == constant.ChannelTypeAdvancedCustom {
		result, err := fetchAdvancedCustomBalance(channel, channel.Key)
		if err != nil {
			return channelBalanceResult{}, err
		}
		if result.RawResponse == "" {
			channel.UpdateBalance(result.Balance)
		}
		return result, nil
	}
	value, err := fetchStandardChannelBalance(channel, channel.Key)
	if err != nil {
		return channelBalanceResult{}, err
	}
	// The owner quota is shared by every key of one upstream account, so a
	// single key is still limited by it.
	balance := value.Balance
	if value.AccountCap != nil {
		balance = min(balance, *value.AccountCap)
	}
	channel.UpdateBalance(balance)
	return channelBalanceResult{Balance: balance}, nil
}

// aggregateMultiKeyChannelBalance queries every enabled key of a multi-key
// channel and adds the results up. A key that fails is reported per key, and
// the sum then only covers the keys that answered, so an unreachable key never
// makes the channel look exhausted. Values the upstream reports for the whole
// account rather than for the key are counted once, and a shared ceiling caps
// the sum instead of being added up.
// aggregateMultiKeyChannelBalance queries every enabled key of a multi-key
// channel and adds the results up. A key that fails is reported per key, and the
// sum then only covers the keys that answered, so an unreachable key never makes
// the channel look exhausted. Keys are assumed to belong to one upstream
// account: a value the upstream reports for the whole account rather than for
// the key is counted once, and a shared ceiling caps the sum instead of being
// added up.
func aggregateMultiKeyChannelBalance(channel *model.Channel) (channelBalanceResult, error) {
	keys := channel.GetKeys()
	enabledIndexes := make([]int, 0, len(keys))
	for i := range keys {
		if status, ok := channel.ChannelInfo.MultiKeyStatusList[i]; ok && status != common.ChannelStatusEnabled {
			continue
		}
		enabledIndexes = append(enabledIndexes, i)
	}
	if len(enabledIndexes) == 0 {
		return channelBalanceResult{}, common.NewMessage("Multi-key channel has no enabled key to query")
	}

	// quota_per_unit belongs to the channel, not to a key, so resolve it once.
	var newAPIQuotaPerUnit float64
	if channel.Type == constant.ChannelTypeNewAPI {
		quotaPerUnit, err := fetchChannelNewAPIQuotaPerUnit(channel)
		if err != nil {
			return channelBalanceResult{}, err
		}
		newAPIQuotaPerUnit = quotaPerUnit
	}

	result := channelBalanceResult{Keys: make([]channelKeyBalance, 0, len(enabledIndexes))}
	var keyLevelSum float64
	var accountLevelValue float64
	seenAccountLevel := false
	var accountCap *float64
	sawUnboundedKey := false
	answered := 0
	for position, index := range enabledIndexes {
		if position > 0 && common.RequestInterval > 0 {
			time.Sleep(common.RequestInterval)
		}
		keyPreview := keys[index]
		if len(keyPreview) > 10 {
			keyPreview = keyPreview[:10] + "..."
		}
		entry := channelKeyBalance{Index: index, KeyPreview: keyPreview}

		var value channelKeyBalanceValue
		var err error
		switch {
		case channel.Type == constant.ChannelTypeAdvancedCustom:
			// The route answers with raw JSON when it cannot be read as a balance;
			// show that payload instead of a partial total.
			var advanced channelBalanceResult
			advanced, err = fetchAdvancedCustomBalance(channel, keys[index])
			if err == nil && advanced.RawResponse != "" {
				return channelBalanceResult{RawResponse: advanced.RawResponse}, nil
			}
			value = channelKeyBalanceValue{Balance: advanced.Balance}
		case channel.Type == constant.ChannelTypeNewAPI:
			value, err = fetchChannelNewAPIBalanceForKey(channel, keys[index], newAPIQuotaPerUnit)
		default:
			value, err = fetchStandardChannelBalance(channel, keys[index])
		}
		if err == nil {
			switch {
			case math.IsNaN(value.Balance), math.IsInf(value.Balance, -1):
				err = errors.New("the upstream reported a non-finite balance for this key")
			case math.IsInf(value.Balance, 1):
				if value.AccountCap == nil {
					err = errors.New("the upstream reported an unlimited balance for this key without a shared account quota")
				} else {
					sawUnboundedKey = true
				}
			}
		}

		if err != nil {
			entry.Error = err.Error()
			result.Partial = true
		} else {
			balance := value.Balance
			if math.IsInf(balance, 1) && value.AccountCap != nil {
				// An unlimited key can spend up to the shared account quota.
				balance = *value.AccountCap
			}
			entry.Balance = &balance
			answered++
			if !math.IsInf(value.Balance, 1) {
				if value.AccountLevel {
					if !seenAccountLevel {
						accountLevelValue = value.Balance
						seenAccountLevel = true
					} else {
						accountLevelValue = max(accountLevelValue, value.Balance)
					}
				} else {
					keyLevelSum += value.Balance
				}
			}
			if value.AccountCap != nil && (accountCap == nil || *value.AccountCap > *accountCap) {
				accountCap = value.AccountCap
			}
		}
		result.Keys = append(result.Keys, entry)
	}
	if answered == 0 {
		return channelBalanceResult{}, fmt.Errorf("every enabled key failed to report a balance, first error: %s", result.Keys[0].Error)
	}

	total := keyLevelSum
	if seenAccountLevel {
		total += accountLevelValue
	}
	if accountCap != nil {
		total = min(total, *accountCap)
	}
	if sawUnboundedKey && accountCap != nil {
		total = *accountCap
	}
	channel.UpdateBalance(total)
	result.Balance = total
	return result, nil
}

func fetchStandardChannelBalance(channel *model.Channel, key string) (channelKeyBalanceValue, error) {
	baseURL := constant.GetChannelBaseURL(channel.Type)
	if channel.GetBaseURL() == "" {
		channel.BaseURL = &baseURL
	}
	switch channel.Type {
	case constant.ChannelTypeOpenAI:
		if channel.GetBaseURL() != "" {
			baseURL = channel.GetBaseURL()
		}
	case constant.ChannelTypeAzure:
		return channelKeyBalanceValue{}, common.NewMessage("Not implemented yet")
	case constant.ChannelTypeCustom:
		baseURL = channel.GetBaseURL()
	//case common.ChannelTypeOpenAISB:
	//	return updateChannelOpenAISBBalance(channel)
	case constant.ChannelTypeAIProxy:
		return fetchChannelAIProxyBalance(channel, key)
	case constant.ChannelTypeAPI2GPT:
		return fetchChannelAPI2GPTBalance(channel, key)
	case constant.ChannelTypeAIGC2D:
		return fetchChannelAIGC2DBalance(channel, key)
	case constant.ChannelTypeSiliconFlow:
		return fetchChannelSiliconFlowBalance(channel, key)
	case constant.ChannelTypeDeepSeek:
		return fetchChannelDeepSeekBalance(channel, key)
	case constant.ChannelTypeOpenRouter:
		return fetchChannelOpenRouterBalance(channel, key)
	case constant.ChannelTypeMoonshot:
		return fetchChannelMoonshotBalance(channel, key)
	case constant.ChannelTypeSub2API:
		return fetchChannelSub2APIBalance(channel, key)
	case constant.ChannelTypeNewAPI:
		return fetchChannelNewAPIBalance(channel, key)
	default:
		return channelKeyBalanceValue{}, common.NewMessage("Not implemented yet")
	}
	url := fmt.Sprintf("%s/v1/dashboard/billing/subscription", baseURL)

	body, err := GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	subscription := OpenAISubscriptionResponse{}
	err = common.Unmarshal(body, &subscription)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	now := time.Now()
	startDate := fmt.Sprintf("%s-01", now.Format("2006-01"))
	endDate := now.Format("2006-01-02")
	if !subscription.HasPaymentMethod {
		startDate = now.AddDate(0, 0, -100).Format("2006-01-02")
	}
	url = fmt.Sprintf("%s/v1/dashboard/billing/usage?start_date=%s&end_date=%s", baseURL, startDate, endDate)
	body, err = GetResponseBody("GET", url, channel, GetAuthHeader(key))
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	usage := OpenAIUsageResponse{}
	err = common.Unmarshal(body, &usage)
	if err != nil {
		return channelKeyBalanceValue{}, err
	}
	return channelKeyBalanceValue{Balance: subscription.HardLimitUSD - usage.TotalUsage/100}, nil
}

func UpdateChannelBalance(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channel, err := model.CacheGetChannel(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if channel.Type == constant.ChannelTypeTaskPlugin {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "Task Plugin channels do not support balance queries"})
		return
	}
	result, err := updateChannelBalance(channel)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := gin.H{
		"success": true,
		"message": "",
	}
	if result.RawResponse != "" {
		response["raw_response"] = result.RawResponse
	} else {
		response["balance"] = result.Balance
		if len(result.Keys) > 0 {
			response["keys"] = result.Keys
		}
	}
	c.JSON(http.StatusOK, response)
}

func updateAllChannelsBalance() error {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return err
	}
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		// TODO: support Azure
		//if channel.Type != common.ChannelTypeOpenAI && channel.Type != common.ChannelTypeCustom {
		//	continue
		//}
		result, err := updateChannelBalance(channel)
		if err != nil {
			continue
		} else if result.RawResponse == "" && !result.Partial {
			// err is nil & balance <= 0 means quota is used up
			if result.Balance <= 0 {
				service.DisableChannel(*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, "", channel.GetAutoBan()), "Insufficient balance")
			}
		}
		time.Sleep(common.RequestInterval)
	}
	return nil
}

func UpdateAllChannelsBalance(c *gin.Context) {
	// TODO: make it async
	err := updateAllChannelsBalance()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func AutomaticallyUpdateChannels(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Minute)
		common.SysLog(common.LogText("updating all channels"))
		_ = updateAllChannelsBalance()
		common.SysLog(common.LogText("channels update done"))
	}
}
