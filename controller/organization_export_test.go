package controller

import (
	"bytes"
	"encoding/csv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOrganizationBillingExportAmountFormatter(t *testing.T) {
	originalGeneralSetting := *operation_setting.GetGeneralSetting()
	originalUSDExchangeRate := operation_setting.USDExchangeRate
	t.Cleanup(func() {
		*operation_setting.GetGeneralSetting() = originalGeneralSetting
		operation_setting.USDExchangeRate = originalUSDExchangeRate
	})

	testCases := []struct {
		name         string
		displayType  string
		exchangeRate float64
		symbol       string
		wantAmount   string
		wantCurrency string
	}{
		{name: "usd", displayType: operation_setting.QuotaDisplayTypeUSD, exchangeRate: 1, wantAmount: "1.000000", wantCurrency: "USD"},
		{name: "cny", displayType: operation_setting.QuotaDisplayTypeCNY, exchangeRate: 7.3, wantAmount: "7.300000", wantCurrency: "CNY"},
		{name: "tokens still expose money", displayType: operation_setting.QuotaDisplayTypeTokens, exchangeRate: 1, wantAmount: "1.000000", wantCurrency: "USD"},
		{name: "custom", displayType: operation_setting.QuotaDisplayTypeCustom, exchangeRate: 0.9, symbol: "€", wantAmount: "0.900000", wantCurrency: "CUSTOM(€)"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = testCase.displayType
			operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate = testCase.exchangeRate
			operation_setting.GetGeneralSetting().CustomCurrencySymbol = testCase.symbol
			operation_setting.USDExchangeRate = testCase.exchangeRate

			formatter := newOrganizationBillingExportAmountFormatter()
			assert.Equal(t, testCase.wantCurrency, formatter.currency)
			assert.Equal(t, testCase.wantAmount, formatter.amount(int(common.QuotaPerUnit)))
		})
	}
}

func TestWriteOrganizationBillingCsvIncludesConsumptionAmountContract(t *testing.T) {
	originalGeneralSetting := *operation_setting.GetGeneralSetting()
	t.Cleanup(func() {
		*operation_setting.GetGeneralSetting() = originalGeneralSetting
	})
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD

	data := organizationBillingExportData{
		Summary: &model.OrganizationBillingSummary{TotalQuota: int(common.QuotaPerUnit)},
		Members: []model.OrganizationBillingDimension{{Username: "alice", TotalQuota: int(common.QuotaPerUnit) / 2}},
		Models: []model.OrganizationBillingDimension{{
			ModelName:  "gpt-test",
			TotalQuota: int(common.QuotaPerUnit),
			Pricing:    &model.PricingSnapshot{QuotaType: 1, ModelPrice: 0.01},
		}},
		Channels: []model.OrganizationBillingDimension{{ChannelName: "primary", TotalQuota: int(common.QuotaPerUnit)}},
		Trend:    []model.OrganizationBillingTrendPoint{{Period: "2026-07-15", TotalQuota: int(common.QuotaPerUnit)}},
		Logs:     []*model.Log{{Username: "alice", ModelName: "gpt-test", ChannelName: "primary", Quota: int(common.QuotaPerUnit)}},
	}

	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	writeOrganizationBillingCsv(writer, data)
	writer.Flush()
	require.NoError(t, writer.Error())

	exported := buffer.String()
	assert.Contains(t, exported, "消费金额,1.000000")
	assert.Contains(t, exported, "币种,USD")
	assert.Contains(t, exported, "用户名,显示名,消费金额,币种,消费额度(quota)")
	assert.Contains(t, exported, "模型,消费金额,币种,当前计价规则,消费额度(quota)")
	assert.Contains(t, exported, "gpt-test,1.000000,USD,固定价格 USD 0.01")
	assert.Contains(t, exported, "渠道,消费金额,币种,消费额度(quota)")
	assert.Contains(t, exported, "日期,消费金额,币种,消费额度(quota)")
	assert.Contains(t, exported, "模型,渠道,消费金额,币种,消费额度(quota)")
	assert.False(t, strings.Contains(exported, "金额,$"), "amount must remain numeric for spreadsheet aggregation")
}

func TestWriteOrganizationBillingLogsCsvKeepsLegacyContract(t *testing.T) {
	logs := []*model.Log{{
		Id:                7,
		CreatedAt:         1_752_537_600,
		Type:              model.LogTypeConsume,
		UserId:            11,
		Username:          "alice",
		TokenName:         "primary-key",
		ModelName:         "gpt-test",
		Quota:             500_000,
		PromptTokens:      120,
		CompletionTokens:  30,
		ChannelId:         9,
		ChannelName:       "primary",
		RequestId:         "req-local",
		UpstreamRequestId: "req-upstream",
		Content:           "consume test",
	}}

	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	writeOrganizationBillingLogsCsv(writer, logs)
	writer.Flush()
	require.NoError(t, writer.Error())

	records, err := csv.NewReader(strings.NewReader(buffer.String())).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	assert.Equal(t, []string{
		"id",
		"created_at",
		"type",
		"user_id",
		"username",
		"token_name",
		"model_name",
		"quota",
		"prompt_tokens",
		"completion_tokens",
		"channel_id",
		"channel_name",
		"request_id",
		"upstream_request_id",
		"content",
	}, records[0])
	assert.Equal(t, []string{
		"7",
		"1752537600",
		"2",
		"11",
		"alice",
		"primary-key",
		"gpt-test",
		"500000",
		"120",
		"30",
		"9",
		"primary",
		"req-local",
		"req-upstream",
		"consume test",
	}, records[1])
}
