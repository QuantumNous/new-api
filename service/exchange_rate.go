package service

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	exchangeRateInterval   = 24 * time.Hour
	exchangeRateOptionKey  = "USDToCNYRate"
	exchangeRateAPIURL     = "https://open.er-api.com/v6/latest/USD"
	exchangeRateFallback   = 7.3
)

var exchangeRateOnce sync.Once

func StartExchangeRateFetchTask() {
	exchangeRateOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), "exchange-rate task started")
			ticker := time.NewTicker(exchangeRateInterval)
			defer ticker.Stop()
			fetchAndCacheExchangeRate()
			for range ticker.C {
				fetchAndCacheExchangeRate()
			}
		})
	})
}

func fetchAndCacheExchangeRate() {
	ctx := context.Background()
	type rateResp struct {
		Result string             `json:"result"`
		Rates  map[string]float64 `json:"rates"`
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(exchangeRateAPIURL)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("exchange-rate: fetch failed: %v", err))
		return
	}
	defer resp.Body.Close()
	var data rateResp
	if err := common.DecodeJson(resp.Body, &data); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("exchange-rate: decode failed: %v", err))
		return
	}
	cny, ok := data.Rates["CNY"]
	if !ok || cny <= 0 {
		logger.LogWarn(ctx, "exchange-rate: CNY rate missing in response")
		return
	}
	val := fmt.Sprintf("%.4f", cny)
	if err := model.UpdateOption(exchangeRateOptionKey, val); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("exchange-rate: save failed: %v", err))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("exchange-rate: USD/CNY = %s", val))
}

func GetCachedUSDToCNYRate() float64 {
	common.OptionMapRWMutex.RLock()
	val, ok := common.OptionMap[exchangeRateOptionKey]
	common.OptionMapRWMutex.RUnlock()
	if !ok || val == "" {
		return exchangeRateFallback
	}
	var rate float64
	if _, err := fmt.Sscanf(val, "%f", &rate); err != nil || rate <= 0 {
		return exchangeRateFallback
	}
	return rate
}
