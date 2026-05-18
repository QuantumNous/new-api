package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	promotionWebhookMaxAttempts    = 3
	promotionWebhookRetryBatchSize = 50
	promotionWebhookSchemaVersion  = "2026-05-16"
	promotionWebhookSourceSystem   = "infistar_newapi"

	PromotionWebhookEventUserRegistered       = "user.registered"
	PromotionWebhookEventUserStatus           = "user.status_changed"
	PromotionWebhookEventTopupSucceeded       = "topup.succeeded"
	PromotionWebhookEventTopupManualCompleted = "topup.manual_completed"
	PromotionWebhookEventSubscriptionPaid     = "subscription.paid"
)

type PromotionWebhookEnvelope struct {
	EventID       string      `json:"event_id"`
	EventType     string      `json:"event_type"`
	SourceSystem  string      `json:"source_system"`
	SchemaVersion string      `json:"schema_version"`
	OccurredAt    string      `json:"occurred_at"`
	DedupeKey     string      `json:"dedupe_key"`
	NewAPIUserID  string      `json:"newapi_user_id"`
	Payload       interface{} `json:"payload"`
}

type PromotionUserRegisteredPayload struct {
	UserID         int    `json:"user_id"`
	UserStatus     string `json:"user_status"`
	ManualReferral string `json:"manual_referral"`
	LinkReferral   string `json:"link_referral"`
	ReferralValue  string `json:"referral_value"`
}

type PromotionTopupSucceededPayload struct {
	TopupID               string `json:"topup_id"`
	TradeNo               string `json:"trade_no"`
	Money                 string `json:"money"`
	GrossAmount           string `json:"gross_amount"`
	EffectiveGMV          string `json:"effective_gmv"`
	Currency              string `json:"currency"`
	PaymentMethod         string `json:"payment_method"`
	PaymentScene          string `json:"payment_scene"`
	EligibleForCommission bool   `json:"eligible_for_commission"`
}

type PromotionUserStatusPayload struct {
	UserID     int    `json:"user_id"`
	UserStatus string `json:"user_status"`
}

func EmitPromotionUserRegistered(userID int, manualReferral string, linkReferral string) {
	referralValue := manualReferral
	if referralValue == "" {
		referralValue = linkReferral
	}
	queuePromotionWebhook(PromotionWebhookEventUserRegistered, userID, fmt.Sprintf("user:%d:registered", userID), PromotionUserRegisteredPayload{
		UserID:         userID,
		UserStatus:     "normal",
		ManualReferral: manualReferral,
		LinkReferral:   linkReferral,
		ReferralValue:  referralValue,
	})
}

func EmitPromotionTopupSucceeded(topUp *model.TopUp, currency string) {
	emitPromotionTopupEvent(PromotionWebhookEventTopupSucceeded, topUp, currency, "succeeded", "recharge")
}

func EmitPromotionTopupManualCompleted(topUp *model.TopUp, currency string) {
	emitPromotionTopupEvent(PromotionWebhookEventTopupManualCompleted, topUp, currency, "manual_completed", "recharge")
}

func EmitPromotionSubscriptionPaid(topUp *model.TopUp, currency string) {
	emitPromotionTopupEvent(PromotionWebhookEventSubscriptionPaid, topUp, currency, "subscription_paid", "subscription")
}

func emitPromotionTopupEvent(eventType string, topUp *model.TopUp, currency string, dedupeSuffix string, paymentScene string) {
	if topUp == nil {
		return
	}
	if currency == "" {
		currency = "CNY"
	}
	money := fmt.Sprintf("%.2f", topUp.Money)
	queuePromotionWebhook(eventType, topUp.UserId, fmt.Sprintf("topup:%s:%s", topUp.TradeNo, dedupeSuffix), PromotionTopupSucceededPayload{
		TopupID:               fmt.Sprintf("tp_%d", topUp.Id),
		TradeNo:               topUp.TradeNo,
		Money:                 money,
		GrossAmount:           money,
		EffectiveGMV:          money,
		Currency:              strings.ToUpper(currency),
		PaymentMethod:         topUp.PaymentMethod,
		PaymentScene:          paymentScene,
		EligibleForCommission: true,
	})
}

func EmitPromotionUserStatus(userID int, status string) {
	queuePromotionWebhook(PromotionWebhookEventUserStatus, userID, fmt.Sprintf("user:%d:status:%s", userID, status), PromotionUserStatusPayload{
		UserID:     userID,
		UserStatus: status,
	})
}

func queuePromotionWebhook(eventType string, userID int, dedupeKey string, payload interface{}) {
	webhookURL := strings.TrimSpace(system_setting.PromotionWebhookUrl)
	if webhookURL == "" {
		return
	}

	now := time.Now().UTC()
	eventID := stablePromotionEventID(dedupeKey)
	envelope := PromotionWebhookEnvelope{
		EventID:       eventID,
		EventType:     eventType,
		SourceSystem:  promotionWebhookSourceSystem,
		SchemaVersion: promotionWebhookSchemaVersion,
		OccurredAt:    now.Format(time.RFC3339),
		DedupeKey:     dedupeKey,
		NewAPIUserID:  strconv.Itoa(userID),
		Payload:       payload,
	}
	body, err := common.Marshal(envelope)
	if err != nil {
		common.SysLog("failed to marshal promotion webhook payload: " + err.Error())
		return
	}

	log := &model.PromotionWebhookLog{
		EventID:      envelope.EventID,
		EventType:    envelope.EventType,
		DedupeKey:    envelope.DedupeKey,
		NewAPIUserID: envelope.NewAPIUserID,
		WebhookURL:   webhookURL,
		Payload:      string(body),
	}
	created, err := model.CreatePromotionWebhookLogOnce(log)
	if err != nil {
		common.SysLog("failed to create promotion webhook log: " + err.Error())
		return
	}
	if !created {
		return
	}

	gopool.Go(func() {
		deliverPromotionWebhookLog(log.Id)
	})
}

func stablePromotionEventID(dedupeKey string) string {
	sum := sha256.Sum256([]byte(dedupeKey))
	return "evt_" + hex.EncodeToString(sum[:])[:32]
}

func deliverPromotionWebhookLog(logID int) {
	log, err := model.GetPromotionWebhookLogByID(logID)
	if err != nil {
		common.SysLog("failed to get promotion webhook log: " + err.Error())
		return
	}
	if log.Status == model.PromotionWebhookStatusSuccess || log.Attempts >= promotionWebhookMaxAttempts {
		return
	}
	attempt := log.Attempts + 1
	now := common.GetTimestamp()
	httpStatus, responseBody, sendErr := sendPromotionWebhook(log.WebhookURL, strings.TrimSpace(system_setting.PromotionWebhookSecret), []byte(log.Payload))
	if sendErr == nil {
		_ = model.UpdatePromotionWebhookLogResult(log.Id, model.PromotionWebhookStatusSuccess, attempt, httpStatus, responseBody, "", 0, now)
		return
	}

	status := model.PromotionWebhookStatusPending
	nextRetryAt := now + int64(60*(1<<(attempt-1)))
	if attempt >= promotionWebhookMaxAttempts {
		status = model.PromotionWebhookStatusFailed
		nextRetryAt = 0
	}
	_ = model.UpdatePromotionWebhookLogResult(log.Id, status, attempt, httpStatus, responseBody, sendErr.Error(), nextRetryAt, now)
}

func ResendPromotionWebhookLog(logID int) error {
	log, err := model.ResetPromotionWebhookLogForResend(logID)
	if err != nil {
		return err
	}
	gopool.Go(func() {
		deliverPromotionWebhookLog(log.Id)
	})
	return nil
}

func StartPromotionWebhookRetryTask() {
	if !common.IsMasterNode {
		return
	}
	gopool.Go(func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			logs, err := model.GetDuePromotionWebhookLogs(common.GetTimestamp(), promotionWebhookRetryBatchSize)
			if err != nil {
				common.SysLog("failed to load due promotion webhook logs: " + err.Error())
				continue
			}
			for _, log := range logs {
				logID := log.Id
				gopool.Go(func() {
					deliverPromotionWebhookLog(logID)
				})
			}
		}
	})
}

func sendPromotionWebhook(webhookURL string, secret string, body []byte) (int, string, error) {
	var resp *http.Response
	var err error
	if system_setting.EnableWorker() {
		workerReq := &WorkerRequest{
			URL:    webhookURL,
			Key:    system_setting.WorkerValidKey,
			Method: http.MethodPost,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: body,
		}
		if secret != "" {
			workerReq.Headers["X-Webhook-Signature"] = generateSignature(secret, body)
			workerReq.Headers["Authorization"] = "Bearer " + secret
		}
		resp, err = DoWorkerRequest(workerReq)
	} else {
		fetchSetting := system_setting.GetFetchSetting()
		if err := common.ValidateURLWithFetchSetting(webhookURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
			return 0, "", fmt.Errorf("request reject: %v", err)
		}
		req, reqErr := http.NewRequest(http.MethodPost, webhookURL, bytes.NewBuffer(body))
		if reqErr != nil {
			return 0, "", reqErr
		}
		req.Header.Set("Content-Type", "application/json")
		if secret != "" {
			req.Header.Set("X-Webhook-Signature", generateSignature(secret, body))
			req.Header.Set("Authorization", "Bearer "+secret)
		}
		resp, err = GetHttpClient().Do(req)
	}
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	responseBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	responseBody := string(responseBytes)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return resp.StatusCode, responseBody, fmt.Errorf("promotion webhook failed with status code: %d", resp.StatusCode)
	}
	return resp.StatusCode, responseBody, nil
}
