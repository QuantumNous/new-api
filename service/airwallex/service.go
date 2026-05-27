package airwallex

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var clientCache sync.Map

func GetPaymentMethodTypes(ctx context.Context, biz, currency, countryCode string) ([]PaymentMethodType, error) {
	cfg := operation_setting.GetAirwallexSetting()
	acct, ok := cfg.Accounts[biz]
	if !ok {
		return nil, fmt.Errorf("unknown biz: %s", biz)
	}
	if !acct.Enabled {
		return nil, fmt.Errorf("biz %s is disabled", biz)
	}

	currency = strings.ToUpper(currency)
	countryCode = strings.ToUpper(countryCode)
	cacheKey := fmt.Sprintf("airwallex:pm_types:%s:%s:%s:oneoff", biz, currency, countryCode)
	if common.RedisEnabled {
		if cached, err := common.RedisGet(cacheKey); err == nil && cached != "" {
			var items []PaymentMethodType
			if json.Unmarshal([]byte(cached), &items) == nil {
				return filterMethods(items, cfg.AllowedPaymentMethods), nil
			}
		}
	}

	client := GetOrCreateClient(biz, acct, cfg)
	resp, err := client.ListPaymentMethodTypes(ctx, ListPaymentMethodTypesQuery{
		TransactionCurrency: currency,
		TransactionMode:     "oneoff",
		CountryCode:         countryCode,
	})
	if err != nil {
		return nil, fmt.Errorf("airwallex list payment method types: %w", err)
	}

	if common.RedisEnabled && len(resp.Items) > 0 {
		if data, err := json.Marshal(resp.Items); err == nil {
			ttl := cfg.PaymentMethodsCacheTTLSeconds
			if ttl <= 0 {
				ttl = 600
			}
			_ = common.RedisSet(cacheKey, string(data), time.Duration(ttl)*time.Second)
		}
	}
	return filterMethods(resp.Items, cfg.AllowedPaymentMethods), nil
}

func GetOrCreateClient(biz string, acct operation_setting.AirwallexAccount, cfg *operation_setting.AirwallexSetting) *Client {
	cacheKey := clientCacheKey(biz, acct, cfg)
	if cached, ok := clientCache.Load(cacheKey); ok {
		return cached.(*Client)
	}
	c := NewClient(Config{
		BaseURL:           acct.BaseURL,
		ClientID:          acct.ClientID,
		APIKey:            acct.APIKey,
		LoginAs:           acct.LoginAs,
		TokenCacheTTL:     time.Duration(cfg.TokenCacheTTLSeconds) * time.Second,
		TokenEarlyRefresh: time.Duration(cfg.TokenEarlyRefreshSeconds) * time.Second,
		HTTPClient: &http.Client{
			Timeout: time.Duration(cfg.HTTPTimeoutSeconds) * time.Second,
		},
	})
	actual, _ := clientCache.LoadOrStore(cacheKey, c)
	return actual.(*Client)
}

func clientCacheKey(biz string, acct operation_setting.AirwallexAccount, cfg *operation_setting.AirwallexSetting) string {
	source := fmt.Sprintf("%s\x00%s\x00%s\x00%s\x00%d\x00%d\x00%d",
		acct.BaseURL,
		acct.ClientID,
		acct.APIKey,
		acct.LoginAs,
		cfg.TokenCacheTTLSeconds,
		cfg.TokenEarlyRefreshSeconds,
		cfg.HTTPTimeoutSeconds,
	)
	sum := sha256.Sum256([]byte(source))
	return fmt.Sprintf("%s:%x", biz, sum)
}

func ResetClientCache() {
	clientCache.Range(func(key, _ any) bool {
		clientCache.Delete(key)
		return true
	})
}

func filterMethods(items []PaymentMethodType, allowed []string) []PaymentMethodType {
	if len(allowed) == 0 {
		return items
	}
	set := make(map[string]struct{}, len(allowed))
	for _, method := range allowed {
		set[normalizeAirwallexMethodID(method)] = struct{}{}
	}
	out := make([]PaymentMethodType, 0, len(items))
	for _, item := range items {
		id := airwallexMethodID(item)
		if _, ok := set[id]; ok {
			out = append(out, item)
		}
	}
	return out
}
