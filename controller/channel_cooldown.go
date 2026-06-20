package controller

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
)

// handleChannelErrorCooldown is the cooldown-aware replacement for the
// old binary auto-ban decision in processChannelError. It classifies
// the error (business / temp / unknown) and either marks a key in
// cooldown, disables the channel (legacy behaviour), or leaves it
// alone.
//
// Decision table:
//
//	class            | cooldown > 0         | cooldown == 0         | cooldown < 0
//	-----------------+----------------------+----------------------+----------------
//	BusinessError    | per-key cooldown     | legacy AutoDisabled  | log only
//	TempError        | per-key cooldown     | log only             | log only
//	Unknown          | log only             | log only             | log only
//
// The unit of the cooldown is the **API key**, not the channel. We
// prefer per-key granularity even for channels the operator
// configured as single-key: from the selector's perspective, "the
// only key on this channel is bad" is a perfectly valid reason to
// skip that key. The selector's per-key filter
// (GetNextEnabledKey) accepts any non-negative key index, so we
// don't gate on the channel's own multi-key flag here. This is the
// change that makes single-key channels behave the same as
// multi-key channels at the cooldown layer.
//
// Whole-channel cooldown is the fallback for the rare case where
// the distributor did not propagate a key index at all (older
// code paths, missing context, etc.). The channel-level cooldown
// map stays in place for that path.
//
// "Legacy AutoDisabled" means we fall back to the historical
// ShouldDisableChannel check. If that returns true, the channel is
// permanently marked AutoDisabled (Status=3) and must be re-enabled
// by hand in the admin UI. This preserves the operator's escape
// hatch for unusual upstream behaviour that doesn't match our
// classifier.
func handleChannelErrorCooldown(channelError types.ChannelError, err *types.NewAPIError) {
	if err == nil || channelError.ChannelId == 0 {
		return
	}
	// AutoBan is the channel-level opt-out for any automatic
	// response to upstream errors. If the operator disabled it
	// explicitly, we honour that — even the lightweight cooldown
	// path stays silent. This mirrors the legacy gating that
	// required `AutoBan=true` before marking a channel disabled.
	if !channelError.AutoBan {
		return
	}
	kind := service.ClassifyChannelError(err)
	logger.LogInfo(nil, fmt.Sprintf("cooldown: channel #%d classified as %s (status=%d, msg=%q)",
		channelError.ChannelId, kind, err.StatusCode, common.LocalLogPreview(err.Error())))

	// Resolve the cooldown target. We default to per-key when we
	// have a non-negative key index; otherwise we fall back to
	// per-channel. The IsMultiKey flag is not consulted here so
	// single-key channels are treated symmetrically.
	keyIndex := -1
	if channelError.KeyIndex != nil {
		keyIndex = *channelError.KeyIndex
	}
	targetIsKey := keyIndex >= 0

	switch kind {
	case service.ChannelErrorBusiness:
		cooldown := operation_setting.BusinessErrorCooldownSeconds
		switch {
		case cooldown > 0:
			until := time.Now().Add(time.Duration(cooldown) * time.Second)
			markCooldownTarget(channelError.ChannelId, keyIndex, targetIsKey, until)
			logger.LogInfo(nil, describeCooldown(
				channelError.ChannelId, keyIndex, targetIsKey,
				"business", err.StatusCode, cooldown, until,
			))
		case cooldown == 0:
			// Fall back to legacy AutoDisabled so operators who
			// explicitly turn the new behaviour off still get the
			// previous result.
			if service.ShouldDisableChannel(err) && channelError.AutoBan {
				disableChannelAsync(channelError, err)
			}
		default:
			// cooldown < 0: explicit "do nothing automatic",
			// just log.
		}
	case service.ChannelErrorTemp:
		cooldown := operation_setting.TempErrorCooldownSeconds
		if cooldown > 0 {
			until := time.Now().Add(time.Duration(cooldown) * time.Second)
			markCooldownTarget(channelError.ChannelId, keyIndex, targetIsKey, until)
			logger.LogInfo(nil, describeCooldown(
				channelError.ChannelId, keyIndex, targetIsKey,
				"temp", err.StatusCode, cooldown, until,
			))
		}
	default:
		// Unknown: preserve the legacy ShouldDisableChannel escape
		// hatch for things like the curated AutomaticDisableKeywords.
		// This is the conservative choice — if the operator
		// explicitly listed a keyword/status in the legacy config,
		// honour it.
		if service.ShouldDisableChannel(err) && channelError.AutoBan {
			disableChannelAsync(channelError, err)
		}
	}
}

// markCooldownTarget routes the cooldown to the correct overlay map.
// When the caller has a known key index, only that key is marked.
// Otherwise the whole channel is marked — there is no finer unit to
// skip.
func markCooldownTarget(channelId int, keyIndex int, targetIsKey bool, until time.Time) {
	if targetIsKey {
		model.MarkKeyCooldown(channelId, keyIndex, until)
		return
	}
	model.MarkCooldown(channelId, until)
}

// describeCooldown formats the log line so the difference between
// per-channel and per-key cooldowns is visible at a glance. The
// "key N of channel M" form is the most common one in production
// (Aliyun multi-credential accounts, OpenAI orgs, etc.) and is
// what an operator skimming logs will be looking for.
func describeCooldown(channelId int, keyIndex int, targetIsKey bool, className string, statusCode int, cooldown int, until time.Time) string {
	subject := fmt.Sprintf("channel #%d", channelId)
	if targetIsKey {
		subject = fmt.Sprintf("key #%d of channel #%d", keyIndex, channelId)
	}
	return fmt.Sprintf(
		"%s hit a %s error (status=%d), entering %ds cooldown until %s",
		subject, className, statusCode, cooldown, until.Format(time.RFC3339),
	)
}

// disableChannelAsync wraps service.DisableChannel in gopool so the
// database write doesn't block the request path. Behaviour matches
// the pre-cooldown processChannelError.
func disableChannelAsync(channelError types.ChannelError, err *types.NewAPIError) {
	gopool.Go(func() {
		service.DisableChannel(channelError, err.ErrorWithStatusCode())
	})
}
