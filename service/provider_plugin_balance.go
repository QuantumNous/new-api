package service

import (
	"maps"
	"math"
	"slices"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// PluginBalanceUSD is a balance result in USD for the balance column: USD as it is,
// CNY at the exchange-rate setting. ok is false for another currency, an
// unlimited result or one without an amount.
func PluginBalanceUSD(result jsplugin.BalanceResult) (balance float64, ok bool) {
	if result.Amount == nil || result.Unlimited {
		return 0, false
	}
	switch result.Currency {
	case "USD":
		return *result.Amount, true
	case "CNY":
		rate := operation_setting.USDExchangeRate
		if rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
			return 0, false
		}
		return *result.Amount / rate, true
	}
	return 0, false
}

// UpdatePluginKeyBalances merges results into the channel's per-key balance
// records and updates the USD balance when the results have one.
func UpdatePluginKeyBalances(channel *model.Channel, balances map[int]model.ChannelBalanceDetail) (*model.ChannelBalanceDetail, error) {
	return model.UpdateChannelBalanceDetail(channel.Id, func(stored *model.ChannelBalanceDetail) (*model.ChannelBalanceDetail, *float64) {
		if stored == nil {
			stored = &model.ChannelBalanceDetail{}
		}
		succeeded, failure := false, ""
		for _, index := range slices.Sorted(maps.Keys(balances)) {
			result := balances[index]
			if result.Error == "" {
				succeeded = true
			} else if failure == "" {
				failure = result.Error
			}
		}
		if !channel.ChannelInfo.IsMultiKey {
			result, ok := balances[0]
			if !ok {
				return nil, nil
			}
			if result.Error != "" {
				stored.Error = result.Error
				return stored, nil
			}
			stored = &result
		} else {
			keyCount := len(channel.GetKeys())
			keys := make(map[string]model.ChannelBalanceDetail, keyCount)
			for index, detail := range stored.Keys {
				if position, err := strconv.Atoi(index); err == nil && position >= 0 && position < keyCount {
					keys[index] = detail
				}
			}
			for index, result := range balances {
				if index < 0 || index >= keyCount {
					continue
				}
				key := strconv.Itoa(index)
				if result.Error != "" {
					detail := keys[key]
					if detail.Windows == nil {
						detail.Windows = []jsplugin.BalanceWindow{}
					}
					detail.Error = result.Error
					keys[key] = detail
				} else {
					keys[key] = result
				}
			}
			stored.Keys = keys
			stored.BalanceResult = sumPluginKeyBalances(keys)
			stored.Error = ""
			if !succeeded {
				stored.Error = failure
			}
		}
		if balance, ok := PluginBalanceUSD(stored.BalanceResult); ok && succeeded {
			return stored, &balance
		}
		return stored, nil
	})
}

// sumPluginKeyBalances is a multi-key channel's own result from its keys': the sum
// of their amounts when they share one currency, unlimited when every key
// with a result is unlimited.
func sumPluginKeyBalances(keys map[string]model.ChannelBalanceDetail) jsplugin.BalanceResult {
	result := jsplugin.BalanceResult{Windows: []jsplugin.BalanceWindow{}}
	var sum float64
	counted, results, unlimited := 0, 0, 0
	for _, key := range keys {
		if key.Amount == nil && !key.Unlimited && len(key.Windows) == 0 {
			continue
		}
		results++
		if key.Unlimited {
			unlimited++
			continue
		}
		if key.Amount == nil {
			continue
		}
		if counted > 0 && key.Currency != result.Currency {
			return jsplugin.BalanceResult{Windows: []jsplugin.BalanceWindow{}}
		}
		result.Currency = key.Currency
		sum += *key.Amount
		counted++
	}
	if results > 0 && unlimited == results {
		result.Unlimited = true
		return result
	}
	if counted > 0 {
		result.Amount = &sum
	}
	return result
}
