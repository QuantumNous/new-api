package service

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const modelChannelAvailabilityRetryMaxDelay = time.Minute

var (
	modelChannelAvailabilityRetryOnce    sync.Once
	modelChannelAvailabilityRetrySignal  = make(chan string, 1)
	modelChannelAvailabilityRetryPending sync.WaitGroup
)

const (
	modelStatusEnabled  = 1
	modelStatusDisabled = 0
)

// ModelChannelAvailabilityResult summarizes one reconciliation pass.
type ModelChannelAvailabilityResult struct {
	Disabled         int
	Enabled          int
	Skipped          bool
	Reason           string
	PricingRefreshed bool
}

// SyncModelChannelAvailability reconciles model status against available channels.
func SyncModelChannelAvailability(reason string) (ModelChannelAvailabilityResult, error) {
	return syncModelChannelAvailability(reason, false)
}

// SyncModelChannelAvailabilityFull also logs a successful zero-change pass.
func SyncModelChannelAvailabilityFull(reason string) (ModelChannelAvailabilityResult, error) {
	return syncModelChannelAvailability(reason, true)
}

// SyncModelChannelAvailabilityAfterMutation runs reconciliation after a primary
// mutation has already committed. A reconciliation failure is logged and queued
// for a coalesced retry, but is not returned as failure for the committed API
// operation. Startup calibration provides an additional recovery boundary.
func SyncModelChannelAvailabilityAfterMutation(reason string) ModelChannelAvailabilityResult {
	result, err := SyncModelChannelAvailability(reason)
	if err == nil {
		return result
	}
	common.SysError(fmt.Sprintf(
		"model channel availability sync after committed mutation failed: reason=%s err=%v",
		reason, err,
	))
	scheduleModelChannelAvailabilityRetry(reason)
	return result
}

func scheduleModelChannelAvailabilityRetry(reason string) {
	modelChannelAvailabilityRetryOnce.Do(func() {
		go runModelChannelAvailabilityRetryWorker()
	})
	modelChannelAvailabilityRetryPending.Add(1)
	select {
	case modelChannelAvailabilityRetrySignal <- reason:
	default:
		modelChannelAvailabilityRetryPending.Done()
		// Reconciliation is global, so one pending pass covers all mutations that
		// committed before that pass reads the database.
	}
}

func runModelChannelAvailabilityRetryWorker() {
	for reason := range modelChannelAvailabilityRetrySignal {
		delay := time.Second
		for {
			if _, err := SyncModelChannelAvailabilityFull("retry." + reason); err == nil {
				break
			} else {
				common.SysError(fmt.Sprintf(
					"model channel availability retry failed: reason=%s retry_in=%s err=%v",
					reason, delay, err,
				))
			}
			time.Sleep(delay)
			delay = min(delay*2, modelChannelAvailabilityRetryMaxDelay)
		}
		modelChannelAvailabilityRetryPending.Done()
	}
}

// CalibrateModelChannelAvailabilityAtStartup repairs stale model status left by
// a process interruption after channel state committed but before reconciliation.
func CalibrateModelChannelAvailabilityAtStartup() error {
	_, err := SyncModelChannelAvailabilityFull("startup")
	return err
}

func syncModelChannelAvailability(reason string, forceFull bool) (ModelChannelAvailabilityResult, error) {
	return reconcileModelChannelAvailability(reason, forceFull, model.ModelChannelAvailabilityConfig{Automatic: true})
}

func reconcileModelChannelAvailability(
	reason string,
	forceFull bool,
	config model.ModelChannelAvailabilityConfig,
) (ModelChannelAvailabilityResult, error) {
	result := ModelChannelAvailabilityResult{Reason: reason}
	modelResult, err := model.ReconcileModelChannelAvailability(config)
	if err != nil {
		return result, fmt.Errorf("reconcile model channel availability: %w", err)
	}
	result.Disabled = modelResult.Disabled
	result.Enabled = modelResult.Enabled
	result.Skipped = modelResult.Skipped

	if result.Disabled > 0 || result.Enabled > 0 {
		model.RefreshPricing()
		result.PricingRefreshed = true
		common.SysLog(fmt.Sprintf(
			"model channel availability sync: reason=%s disabled=%d enabled=%d",
			reason, result.Disabled, result.Enabled,
		))
	} else if reason != "" && forceFull && !result.Skipped {
		common.SysLog(fmt.Sprintf(
			"model channel availability sync: reason=%s disabled=0 enabled=0",
			reason,
		))
	}
	return result, nil
}

// MaybeSyncModelChannelAvailabilityAfterOptionChange triggers full calibration
// when either model availability switch is enabled.
func MaybeSyncModelChannelAvailabilityAfterOptionChange(key string, value string) error {
	if key != "AutomaticDisableModelEnabled" && key != "AutomaticEnableModelEnabled" {
		return nil
	}
	if value != "1" && !strings.EqualFold(value, "true") {
		return nil
	}
	SyncModelChannelAvailabilityAfterMutation(fmt.Sprintf("option.%s=true", key))
	return nil
}

// ManualDisableModelsWithoutChannels disables enabled models with no usable channel.
func ManualDisableModelsWithoutChannels() (ModelChannelAvailabilityResult, error) {
	return reconcileModelChannelAvailability(
		"manual.batch.disable.no-channels",
		false,
		model.ModelChannelAvailabilityConfig{Disable: true},
	)
}

// ManualEnableModelsWithChannels only restores models previously disabled by
// channel-availability automation.
func ManualEnableModelsWithChannels() (ModelChannelAvailabilityResult, error) {
	return reconcileModelChannelAvailability(
		"manual.batch.enable.with-channels",
		false,
		model.ModelChannelAvailabilityConfig{Enable: true},
	)
}
