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
	Campaigns    *RecallCampaignService
	Claims       *RecallClaimService
	Revocations  *RecallPromotionRevocationWorker
	Recipients   *RecallRecipientWorker
	Emails       *RecallEmailWorker
	Translations *RecallTranslationWorker
	Attribution  *RecallAttributionService
}

var (
	recallRuntimeOnce     sync.Once
	recallRuntime         *RecallRuntime
	recallSchedulerOnce   sync.Once
	recallSchedulerWakeCh = make(chan struct{}, 1)
)

func init() {
	model.RegisterOptionReloadHook(NotifyRecallSchedulerConfigChanged)
}

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
			Revocations: NewRecallPromotionRevocationWorker(stripeService, owner),
			Recipients:  NewRecallRecipientWorker(stripeService, claims, owner),
			Emails:      NewRecallEmailWorker(common.SendEmailWithSMTPConfigAndOptions, audience, claims, owner),
			Translations: NewRecallTranslationWorker(
				NewRecallEmailTranslatorFromMonitorSettings(RecallEmailTranslatorOptions{}),
				owner,
			),
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
			drainRecallSchedulerWake()
			RunRecallMaintenanceTick(context.Background())
			for {
				setting := operation_setting.GetRecallCampaignSetting()
				delay := recallMaintenanceDelay(setting.TickSeconds, 0, time.Now().UnixMilli())
				if operation_setting.IsRecallCampaignEnabled() {
					if pacingStatus, err := model.GetRecallEmailPacingStatusWithContext(context.Background(), setting.EmailHourlyLimit); err == nil && !pacingStatus.Allowed {
						delay = recallMaintenanceDelayFromPacingStatus(setting.TickSeconds, pacingStatus, time.Now().UnixMilli())
					}
				}
				if !recallWaitForNextMaintenance(context.Background(), delay, recallSchedulerWakeCh) {
					return
				}
				RunRecallMaintenanceTick(context.Background())
			}
		})
	})
}

func NotifyRecallSchedulerConfigChanged() {
	select {
	case recallSchedulerWakeCh <- struct{}{}:
	default:
	}
}

func drainRecallSchedulerWake() {
	for {
		select {
		case <-recallSchedulerWakeCh:
		default:
			return
		}
	}
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
	if _, err := model.ReconcileRecallMessageStateEventBaseline(ctx, setting.BatchSize); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("recall message state baseline reconciliation failed: %v", err))
	}
	if _, err := runtime.Campaigns.RunDueCampaigns(ctx, time.Now(), setting.BatchSize); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("recall campaign maintenance failed: %v", err))
	}
	if runtime.Revocations != nil {
		if _, err := runtime.Revocations.RunBatch(ctx, setting.BatchSize); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("recall promotion revocation maintenance failed: %v", err))
		}
	}
	if _, err := runtime.Recipients.RunBatch(ctx, setting.BatchSize); err != nil {
		logger.LogWarn(ctx, "recall recipient maintenance failed")
	}
	if runtime.Emails != nil {
		if _, err := runtime.Emails.RunBatch(ctx, setting.BatchSize); err != nil {
			if !isPureRecallEmailQuotaWait(err) {
				logger.LogWarn(ctx, fmt.Sprintf("recall email maintenance failed: %v", err))
			}
		}
	}
	if runtime.Translations != nil {
		if _, err := runtime.Translations.RunBatch(ctx, setting.BatchSize); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("recall translation maintenance failed: %v", err))
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

func isPureRecallEmailQuotaWait(err error) bool {
	if _, ok := err.(*RecallEmailQuotaWaitError); ok {
		return true
	}
	_, ok := err.(*RecallEmailPacingWaitError)
	return ok
}

func recallMaintenanceDelay(tickSeconds int, pacingAtMillis int64, nowMillis int64) time.Duration {
	tickDelay := time.Duration(tickSeconds) * time.Second
	if tickDelay <= 0 {
		tickDelay = time.Second
	}
	if pacingAtMillis > 0 && pacingAtMillis <= nowMillis {
		return 0
	}
	if pacingAtMillis == 0 {
		return tickDelay
	}
	pacingDelay := time.Duration(pacingAtMillis-nowMillis) * time.Millisecond
	if pacingDelay < tickDelay {
		return pacingDelay
	}
	return tickDelay
}

func recallMaintenanceDelayFromPacingStatus(tickSeconds int, pacingStatus model.RecallEmailPacingStatus, localNowMillis int64) time.Duration {
	if pacingStatus.Allowed || pacingStatus.NextAllowedAtMillis <= 0 {
		return recallMaintenanceDelay(tickSeconds, 0, localNowMillis)
	}
	return recallMaintenanceDelay(tickSeconds, pacingStatus.NextAllowedAtMillis, pacingStatus.CheckedAtMillis)
}

func recallWaitForNextMaintenance(ctx context.Context, delay time.Duration, wake <-chan struct{}) bool {
	timer := time.NewTimer(delay)
	defer func() {
		if !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
	}()
	select {
	case <-timer.C:
		return true
	case <-wake:
		return true
	case <-ctx.Done():
		return false
	}
}
