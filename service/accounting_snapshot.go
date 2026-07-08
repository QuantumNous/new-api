package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type ConsumeAccountingInput struct {
	UserId           int
	ChannelId        int
	ModelName        string
	InputTokens      int
	OutputTokens     int
	CacheReadTokens  int
	CacheWriteTokens int
	GroupRatio       float64
	Quota            int
}

type accountingPriceTuple struct {
	InputPrice         float64 `json:"input_price"`
	OutputPrice        float64 `json:"output_price"`
	CachePrice         float64 `json:"cache_price"`
	CacheCreationPrice float64 `json:"cache_creation_price"`
}

type consumeAccountingSnapshot struct {
	Version                 int                `json:"version"`
	Currency                string             `json:"currency"`
	Status                  string             `json:"status"`
	Error                   string             `json:"error,omitempty"`
	UserId                  int                `json:"user_id"`
	ChannelId               int                `json:"channel_id"`
	ModelName               string             `json:"model_name"`
	ResellerUserId          int                `json:"reseller_user_id,omitempty"`
	ResellerRuleId          int                `json:"reseller_rule_id,omitempty"`
	ResellerDiscountRatio   float64            `json:"reseller_discount_ratio,omitempty"`
	GroupRatio              float64            `json:"group_ratio"`
	Quota                   int                `json:"quota"`
	Tokens                  map[string]int     `json:"tokens"`
	Prices                  map[string]any     `json:"prices"`
	AmountsUSD              map[string]float64 `json:"amounts_usd"`
	AccountingAmountVersion string             `json:"accounting_amount_version"`
}

func BuildConsumeAccountingFields(input ConsumeAccountingInput) (fields model.AccountingLogFields) {
	defer func() {
		if r := recover(); r != nil {
			fields.Status = "error"
			fields.Snapshot = common.MapToJsonStr(map[string]interface{}{
				"version":  1,
				"currency": "USD",
				"status":   "error",
				"error":    fmt.Sprintf("panic: %v", r),
			})
		}
	}()

	if input.GroupRatio <= 0 {
		input.GroupRatio = 1
	}
	snap := consumeAccountingSnapshot{
		Version:                 1,
		Currency:                "USD",
		Status:                  "ok",
		UserId:                  input.UserId,
		ChannelId:               input.ChannelId,
		ModelName:               input.ModelName,
		GroupRatio:              input.GroupRatio,
		Quota:                   input.Quota,
		AccountingAmountVersion: "usd_per_1m_tokens_v1",
		Tokens: map[string]int{
			"input":       input.InputTokens,
			"output":      input.OutputTokens,
			"cache_read":  input.CacheReadTokens,
			"cache_write": input.CacheWriteTokens,
		},
		Prices:     map[string]any{},
		AmountsUSD: map[string]float64{},
	}

	status := "ok"
	errorText := ""

	channelCost, err := ChannelProcurementPricesResolved(input.ChannelId, input.ModelName)
	if err != nil {
		status = "partial"
		errorText = appendAccountingError(errorText, "channel_cost_lookup_failed: "+err.Error())
	} else if channelCost == nil {
		status = "partial"
		errorText = appendAccountingError(errorText, "channel_cost_price_missing")
	} else {
		tuple := tupleFromChannelPrices(channelCost)
		snap.Prices["channel_cost"] = tuple
		fields.ChannelCostAmountUSD = amountUSD(tuple, input)
		snap.AmountsUSD["channel_cost"] = fields.ChannelCostAmountUSD
	}

	userPrice, err := ChannelActualPricesResolved(input.ChannelId, input.ModelName)
	if err != nil {
		status = "partial"
		errorText = appendAccountingError(errorText, "user_price_lookup_failed: "+err.Error())
	} else if userPrice == nil {
		status = "partial"
		errorText = appendAccountingError(errorText, "user_price_missing")
	} else {
		tuple := tupleFromChannelPrices(userPrice)
		snap.Prices["user_price"] = tuple
		fields.UserPriceAmountUSD = amountUSD(tuple, input)
		fields.UserFinalAmountUSD = fields.UserPriceAmountUSD * input.GroupRatio
		snap.Prices["user_final_price"] = accountingPriceTuple{
			InputPrice:         tuple.InputPrice * input.GroupRatio,
			OutputPrice:        tuple.OutputPrice * input.GroupRatio,
			CachePrice:         tuple.CachePrice * input.GroupRatio,
			CacheCreationPrice: tuple.CacheCreationPrice * input.GroupRatio,
		}
		snap.AmountsUSD["user_price"] = fields.UserPriceAmountUSD
		snap.AmountsUSD["user_final"] = fields.UserFinalAmountUSD
	}

	official := accountingPriceTuple{}
	if input.ModelName != "" {
		in, out, cache, cacheCreation, ok := GlobalModelPricingUSD(input.ModelName)
		if ok {
			official = accountingPriceTuple{
				InputPrice:         in,
				OutputPrice:        out,
				CachePrice:         cache,
				CacheCreationPrice: cacheCreation,
			}
			snap.Prices["official_price"] = official
		} else {
			status = "partial"
			errorText = appendAccountingError(errorText, "official_price_missing")
		}
	}

	var user model.User
	if err := model.DB.Select("id, reseller_user_id").Where("id = ?", input.UserId).First(&user).Error; err != nil {
		status = "partial"
		errorText = appendAccountingError(errorText, "user_lookup_failed: "+err.Error())
	} else if user.ResellerUserId > 0 {
		fields.ResellerUserId = user.ResellerUserId
		snap.ResellerUserId = user.ResellerUserId
		rule, err := getEnabledResellerRuleByAnyModelName(user.ResellerUserId, input.UserId, input.ModelName)
		if err != nil {
			status = "partial"
			errorText = appendAccountingError(errorText, "reseller_rule_lookup_failed: "+err.Error())
		} else if rule == nil {
			status = "missing_reseller_rule"
			errorText = appendAccountingError(errorText, "reseller_rule_missing")
		} else {
			fields.ResellerRuleId = rule.Id
			fields.ResellerDiscountRatio = rule.DiscountRatio
			snap.ResellerRuleId = rule.Id
			snap.ResellerDiscountRatio = rule.DiscountRatio
			if _, ok := snap.Prices["official_price"]; ok {
				resellerCost := accountingPriceTuple{
					InputPrice:         official.InputPrice * rule.DiscountRatio,
					OutputPrice:        official.OutputPrice * rule.DiscountRatio,
					CachePrice:         official.CachePrice * rule.DiscountRatio,
					CacheCreationPrice: official.CacheCreationPrice * rule.DiscountRatio,
				}
				snap.Prices["reseller_cost"] = resellerCost
				fields.ResellerCostAmountUSD = amountUSD(resellerCost, input)
				snap.AmountsUSD["reseller_cost"] = fields.ResellerCostAmountUSD
			}
		}
	}

	fields.GroupRatio = input.GroupRatio
	fields.Status = status
	if errorText != "" {
		snap.Error = errorText
	}
	snap.Status = status
	fields.Snapshot = common.GetJsonString(snap)
	return fields
}

func tupleFromChannelPrices(p *model.ChannelActualPrices) accountingPriceTuple {
	if p == nil {
		return accountingPriceTuple{}
	}
	return accountingPriceTuple{
		InputPrice:         p.InputPrice,
		OutputPrice:        p.OutputPrice,
		CachePrice:         p.CachePrice,
		CacheCreationPrice: p.CacheCreationPrice,
	}
}

func amountUSD(prices accountingPriceTuple, input ConsumeAccountingInput) float64 {
	return (prices.InputPrice*float64(input.InputTokens) +
		prices.OutputPrice*float64(input.OutputTokens) +
		prices.CachePrice*float64(input.CacheReadTokens) +
		prices.CacheCreationPrice*float64(input.CacheWriteTokens)) / 1000000.0
}

func appendAccountingError(existing string, msg string) string {
	if existing == "" {
		return msg
	}
	return existing + "; " + msg
}

func getEnabledResellerRuleByAnyModelName(resellerId int, downlineId int, modelName string) (*model.ResellerModelRule, error) {
	names := ModelPricingLookupNames(modelName)
	for _, name := range appendUniqueStrings(names, modelName) {
		rule, err := model.GetEnabledResellerRule(resellerId, downlineId, name)
		if err != nil || rule != nil {
			return rule, err
		}
	}
	return nil, nil
}
