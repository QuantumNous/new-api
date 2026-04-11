package governor

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var leaseHeartbeatStarter = startLeaseHeartbeat

func PrepareAttemptForChannel(c *gin.Context, channel *model.Channel) (string, int, *types.NewAPIError) {
	if channel == nil {
		return "", 0, types.NewError(errors.New("channel is nil"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}

	cfg := FromChannel(channel)
	if !cfg.Enabled {
		return channel.GetNextEnabledKey()
	}
	store := storeFactory()
	if store == nil {
		return channel.GetNextEnabledKey()
	}

	ctx := requestContext(c)
	if cooling, _, err := store.IsChannelCooling(ctx, channel.Id); err == nil && cooling {
		return "", 0, selectionRejectedErr("channel is cooling")
	}

	orderedIndices, apiErr := channel.OrderedEnabledKeyIndices()
	if apiErr != nil {
		return "", 0, apiErr
	}

	applyKeyConcurrency := cfg.KeyMaxConcurrency > 0 && !isAsyncTaskSubmit(c)
	for _, keyIndex := range orderedIndices {
		if cooling, _, err := store.IsKeyCooling(ctx, channel.Id, keyIndex); err == nil && cooling {
			continue
		}

		keyValue, keyErr := channel.KeyAt(keyIndex)
		if keyErr != nil {
			return "", 0, keyErr
		}

		reservationID := ""
		leaseHeld := false
		var stopHeartbeat context.CancelFunc
		attempt := &AttemptState{
			ChannelID:           channel.Id,
			ChannelName:         channel.Name,
			KeyIndex:            keyIndex,
			KeyValue:            keyValue,
			ApplyKeyConcurrency: applyKeyConcurrency,
			Config:              cfg,
		}
		if applyKeyConcurrency {
			reservationID = uuid.NewString()
			leaseTTL := time.Duration(cfg.ReservationLeaseSeconds) * time.Second
			waitUntil := time.Now().Add(time.Duration(cfg.ShortWaitMS) * time.Millisecond)
			for {
				acquired, err := store.AcquireKeyLease(ctx, channel.Id, keyIndex, reservationID, cfg.KeyMaxConcurrency, leaseTTL)
				if err != nil {
					return "", 0, governorInfraErr(err)
				}
				if acquired {
					leaseHeld = true
					if cfg.ReservationHeartbeatSeconds > 0 {
						stopHeartbeat = leaseHeartbeatStarter(
							ctx,
							store,
							channel.Id,
							keyIndex,
							reservationID,
							leaseTTL,
							time.Duration(cfg.ReservationHeartbeatSeconds)*time.Second,
						)
					}
					break
				}
				if cfg.ShortWaitMS <= 0 || time.Now().After(waitUntil) {
					break
				}
				time.Sleep(25 * time.Millisecond)
			}
			if !leaseHeld {
				continue
			}
		}
		attempt.ReservationID = reservationID
		attempt.LeaseHeld = leaseHeld
		attempt.StopHeartbeat = stopHeartbeat

		if cfg.ChannelMaxRPM > 0 {
			allowed, err := store.AllowChannelRPM(ctx, channel.Id, cfg.ChannelMaxRPM)
			if err != nil {
				releasePreparedAttempt(ctx, store, attempt)
				return "", 0, governorInfraErr(err)
			}
			if !allowed {
				releasePreparedAttempt(ctx, store, attempt)
				return "", 0, selectionRejectedErr("channel rpm limited")
			}
		}

		if apiErr = channel.CommitSelectedKeyIndex(keyIndex); apiErr != nil {
			releasePreparedAttempt(ctx, store, attempt)
			return "", 0, apiErr
		}

		if c != nil {
			common.SetContextKey(c, constant.ContextKeyGovernorAttempt, attempt)
		}
		return keyValue, keyIndex, nil
	}

	return "", 0, selectionRejectedErr("no governor-eligible keys or channels remain")
}

func startLeaseHeartbeat(parent context.Context, store Store, channelID int, keyIndex int, reservationID string, leaseTTL time.Duration, interval time.Duration) context.CancelFunc {
	if store == nil || reservationID == "" {
		return func() {}
	}
	if interval <= 0 {
		interval = 20 * time.Second
	}
	if leaseTTL <= 0 {
		leaseTTL = 90 * time.Second
	}

	ctx, cancel := context.WithCancel(parent)
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				_ = store.TouchKeyLease(context.Background(), channelID, keyIndex, reservationID, leaseTTL)
			}
		}
	}()
	return cancel
}

func CompleteRelayAttemptFromContext(c *gin.Context, apiErr *types.NewAPIError) {
	attempt := getAttemptFromContext(c)
	if attempt == nil {
		return
	}
	defer clearAttemptFromContext(c)

	stopAndRelease(c, attempt)
	store := storeFactory()
	if store == nil {
		return
	}

	decision := ClassifyRelayError(attempt.Config, apiErr)
	if decision.CoolChannel && decision.TTL > 0 {
		_ = store.CoolChannel(requestContext(c), attempt.ChannelID, decision.TTL)
	}
	if decision.CoolKey && decision.TTL > 0 {
		_ = store.CoolKey(requestContext(c), attempt.ChannelID, attempt.KeyIndex, decision.TTL)
	}
}

func CompleteTaskAttemptFromContext(c *gin.Context, taskErr *dto.TaskError) {
	attempt := getAttemptFromContext(c)
	if attempt == nil {
		return
	}
	defer clearAttemptFromContext(c)

	stopAndRelease(c, attempt)
	store := storeFactory()
	if store == nil {
		return
	}

	decision := ClassifyTaskError(attempt.Config, taskErr)
	if decision.CoolChannel && decision.TTL > 0 {
		_ = store.CoolChannel(requestContext(c), attempt.ChannelID, decision.TTL)
	}
}

func isAsyncTaskSubmit(c *gin.Context) bool {
	if c == nil {
		return false
	}
	if relayMode, ok := c.Get("relay_mode"); ok {
		if mode, ok := relayMode.(int); ok {
			switch mode {
			case relayconstant.RelayModeSunoSubmit,
				relayconstant.RelayModeVideoSubmit,
				relayconstant.RelayModeMidjourneyImagine,
				relayconstant.RelayModeMidjourneyDescribe,
				relayconstant.RelayModeMidjourneyBlend,
				relayconstant.RelayModeMidjourneyChange,
				relayconstant.RelayModeMidjourneySimpleChange,
				relayconstant.RelayModeMidjourneyAction,
				relayconstant.RelayModeMidjourneyModal,
				relayconstant.RelayModeMidjourneyShorten,
				relayconstant.RelayModeSwapFace,
				relayconstant.RelayModeMidjourneyUpload,
				relayconstant.RelayModeMidjourneyVideo,
				relayconstant.RelayModeMidjourneyEdits:
				return true
			}
		}
	}
	return false
}

func selectionRejectedErr(message string) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		errors.New(message),
		types.ErrorCodeGovernorSelectionRejected,
		http.StatusTooManyRequests,
		types.ErrOptionWithSkipRetry(),
		types.ErrOptionWithNoRecordErrorLog(),
	)
}

func governorInfraErr(err error) *types.NewAPIError {
	return types.NewErrorWithStatusCode(err, types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable)
}

func getAttemptFromContext(c *gin.Context) *AttemptState {
	if c == nil {
		return nil
	}
	v, ok := c.Get(string(constant.ContextKeyGovernorAttempt))
	if !ok || v == nil {
		return nil
	}
	attempt, _ := v.(*AttemptState)
	return attempt
}

func clearAttemptFromContext(c *gin.Context) {
	if c == nil || c.Keys == nil {
		return
	}
	delete(c.Keys, string(constant.ContextKeyGovernorAttempt))
}

func stopAndRelease(c *gin.Context, attempt *AttemptState) {
	if attempt == nil {
		return
	}
	store := storeFactory()
	releasePreparedAttempt(requestContext(c), store, attempt)
}

func releasePreparedAttempt(ctx context.Context, store Store, attempt *AttemptState) {
	if attempt == nil {
		return
	}
	if attempt.StopHeartbeat != nil {
		attempt.StopHeartbeat()
		attempt.StopHeartbeat = nil
	}
	if !attempt.LeaseHeld || attempt.ReservationID == "" || store == nil {
		return
	}
	_ = store.ReleaseKeyLease(ctx, attempt.ChannelID, attempt.KeyIndex, attempt.ReservationID)
	attempt.LeaseHeld = false
}

func requestContext(c *gin.Context) context.Context {
	if c != nil && c.Request != nil && c.Request.Context() != nil {
		return c.Request.Context()
	}
	return context.Background()
}
