package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/bytedance/gopkg/util/gopool"
)

type RecallRuntime struct {
	Campaigns   *RecallCampaignService
	Claims      *RecallClaimService
	Recipients  *RecallRecipientWorker
	Emails      *RecallEmailWorker
	Attribution *RecallAttributionService
}

var (
	recallRuntimeOnce   sync.Once
	recallRuntime       *RecallRuntime
	recallSchedulerOnce sync.Once
)

func GetRecallRuntime() *RecallRuntime {
	recallRuntimeOnce.Do(func() {
		stripeClient := NewStripeRecallClient()
		stripeService := NewRecallStripeService(stripeClient)
		claims := NewRecallClaimService()
		audience := NewRecallAudienceSelector()
		owner := common.GetReplicaID()
		recallRuntime = &RecallRuntime{
			Campaigns: NewRecallCampaignServiceWithTranslator(
				audience,
				stripeService,
				NewRecallEmailTranslatorFromMonitorSettings(RecallEmailTranslatorOptions{}),
			),
			Claims:      claims,
			Recipients:  NewRecallRecipientWorker(stripeService, claims, owner),
			Emails:      NewRecallEmailWorker(common.SendEmailWithMessageID, audience, claims, owner),
			Attribution: NewRecallAttributionService(stripeClient),
		}
	})
	return recallRuntime
}

func StartRecallCampaignTasks() {
	recallSchedulerOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			setting := operation_setting.GetRecallCampaignSetting()
			ticker := time.NewTicker(time.Duration(setting.TickSeconds) * time.Second)
			defer ticker.Stop()
			RunRecallMaintenanceTick(context.Background())
			for range ticker.C {
				RunRecallMaintenanceTick(context.Background())
			}
		})
	})
}

func RunRecallMaintenanceTick(ctx context.Context) {
	if !operation_setting.IsRecallCampaignEnabled() {
		return
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			logger.LogWarn(ctx, fmt.Sprintf("recall campaign maintenance panic: %v", recovered))
		}
	}()
	setting := operation_setting.GetRecallCampaignSetting()
	runtime := GetRecallRuntime()
	if _, err := runtime.Campaigns.RunDueCampaigns(ctx, time.Now(), setting.BatchSize); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("recall campaign maintenance failed: %v", err))
	}
	if _, err := runtime.Recipients.RunBatch(ctx, setting.BatchSize); err != nil {
		logger.LogWarn(ctx, "recall recipient maintenance failed")
	}
	if runtime.Emails != nil {
		if _, err := runtime.Emails.RunBatch(ctx, setting.BatchSize); err != nil {
			logger.LogWarn(ctx, "recall email maintenance failed")
		}
	}
	if runtime.Attribution != nil {
		owned, err := model.TryInsertRecallReconciliationWindowWithContext(ctx, time.Now().UTC())
		if err != nil {
			logger.LogWarn(ctx, "recall attribution reconciliation scheduling failed")
		} else if owned {
			if _, err := runtime.Attribution.ReconcileBatch(ctx, setting.BatchSize); err != nil {
				logger.LogWarn(ctx, "recall attribution reconciliation failed")
			}
		}
	}
}
