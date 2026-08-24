package service

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const adsAttributionDeliveryBatchSize = 50

var adsAttributionDeliveryOnce sync.Once

type adsAttributionDeliveryConfig struct {
	BaseURL  string
	TenantID string
	Project  string
	Token    string
}

func loadAdsAttributionDeliveryConfig() adsAttributionDeliveryConfig {
	return adsAttributionDeliveryConfig{
		BaseURL:  strings.TrimRight(strings.TrimSpace(os.Getenv("ADS_ATTRIBUTION_BASE_URL")), "/"),
		TenantID: strings.TrimSpace(os.Getenv("ADS_ATTRIBUTION_TENANT_ID")),
		Project:  strings.TrimSpace(os.Getenv("ADS_ATTRIBUTION_PROJECT_SLUG")),
		Token:    strings.TrimSpace(os.Getenv("ADS_ATTRIBUTION_PROJECT_TOKEN")),
	}
}

func (config adsAttributionDeliveryConfig) valid() bool {
	return config.BaseURL != "" && config.TenantID != "" && config.Project != "" && config.Token != ""
}

func (config adsAttributionDeliveryConfig) endpoint(eventType string) (string, error) {
	suffix := ""
	switch eventType {
	case "signup", "activation":
		suffix = eventType
	case "purchase", "refund":
		suffix = "revenue"
	default:
		return "", fmt.Errorf("unsupported ads attribution event type %q", eventType)
	}
	return fmt.Sprintf(
		"%s/api/tenants/%s/projects/%s/ads/attribution/%s",
		config.BaseURL,
		url.PathEscape(config.TenantID),
		url.PathEscape(config.Project),
		suffix,
	), nil
}

func deliverAdsAttributionEvent(ctx context.Context, client *http.Client, config adsAttributionDeliveryConfig, event model.AdsAttributionOutbox) error {
	endpoint, err := config.endpoint(event.EventType)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBufferString(event.Payload))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+config.Token)
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("ads attribution endpoint returned HTTP %d", response.StatusCode)
	}
	return nil
}

func runAdsAttributionDeliveryOnce(config adsAttributionDeliveryConfig, client *http.Client) {
	now := common.GetTimestamp()
	events, err := model.ClaimAdsAttributionOutbox(adsAttributionDeliveryBatchSize, now)
	if err != nil {
		logger.LogError(context.Background(), "ads attribution outbox claim failed: "+err.Error())
		return
	}
	for _, event := range events {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err := deliverAdsAttributionEvent(ctx, client, config, event)
		cancel()
		if err == nil {
			if completeErr := model.CompleteAdsAttributionOutbox(event.Id, common.GetTimestamp()); completeErr != nil {
				logger.LogError(context.Background(), "ads attribution outbox complete failed: "+completeErr.Error())
			}
			continue
		}
		if failErr := model.FailAdsAttributionOutbox(event.Id, event.Attempts, err.Error(), common.GetTimestamp()); failErr != nil {
			logger.LogError(context.Background(), "ads attribution outbox retry scheduling failed: "+failErr.Error())
		}
	}
}

func StartAdsAttributionDeliveryTask() {
	adsAttributionDeliveryOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		config := loadAdsAttributionDeliveryConfig()
		if !config.valid() {
			logger.LogInfo(context.Background(), "ads attribution delivery disabled: configuration incomplete")
			return
		}
		client := &http.Client{Timeout: 12 * time.Second}
		gopool.Go(func() {
			ticker := time.NewTicker(15 * time.Second)
			defer ticker.Stop()
			runAdsAttributionDeliveryOnce(config, client)
			for range ticker.C {
				runAdsAttributionDeliveryOnce(config, client)
			}
		})
	})
}
