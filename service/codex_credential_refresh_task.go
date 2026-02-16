package service

import (
	"github.com/QuantumNous/new-api/i18n"
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	codexCredentialRefreshTickInterval = 10 * time.Minute
	codexCredentialRefreshThreshold    = 24 * time.Hour
	codexCredentialRefreshBatchSize    = 200
	codexCredentialRefreshTimeout      = 15 * time.Second
)

var (
	codexCredentialRefreshOnce    sync.Once
	codexCredentialRefreshRunning atomic.Bool
)

func StartCodexCredentialAutoRefreshTask() {
	codexCredentialRefreshOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}

		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf(i18n.Translate("svc.codex_credential_auto_refresh_task_started_tick"), codexCredentialRefreshTickInterval, codexCredentialRefreshThreshold))

			ticker := time.NewTicker(codexCredentialRefreshTickInterval)
			defer ticker.Stop()

			runCodexCredentialAutoRefreshOnce()
			for range ticker.C {
				runCodexCredentialAutoRefreshOnce()
			}
		})
	})
}

func runCodexCredentialAutoRefreshOnce() {
	if !codexCredentialRefreshRunning.CompareAndSwap(false, true) {
		return
	}
	defer codexCredentialRefreshRunning.Store(false)

	ctx := context.Background()
	now := time.Now()

	var refreshed int
	var scanned int

	offset := 0
	for {
		var channels []*model.Channel
		err := model.DB.
			Select("id", "name", "key", "status", "channel_info").
			Where("type = ? AND status = 1", constant.ChannelTypeCodex).
			Order("id asc").
			Limit(codexCredentialRefreshBatchSize).
			Offset(offset).
			Find(&channels).Error
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf(i18n.Translate("svc.codex_credential_auto_refresh_query_channels_failed"), err))
			return
		}
		if len(channels) == 0 {
			break
		}
		offset += codexCredentialRefreshBatchSize

		for _, ch := range channels {
			if ch == nil {
				continue
			}
			scanned++
			if ch.ChannelInfo.IsMultiKey {
				continue
			}

			rawKey := strings.TrimSpace(ch.Key)
			if rawKey == "" {
				continue
			}

			oauthKey, err := parseCodexOAuthKey(rawKey)
			if err != nil {
				continue
			}

			refreshToken := strings.TrimSpace(oauthKey.RefreshToken)
			if refreshToken == "" {
				continue
			}

			expiredAtRaw := strings.TrimSpace(oauthKey.Expired)
			expiredAt, err := time.Parse(time.RFC3339, expiredAtRaw)
			if err == nil && !expiredAt.IsZero() && expiredAt.Sub(now) > codexCredentialRefreshThreshold {
				continue
			}

			refreshCtx, cancel := context.WithTimeout(ctx, codexCredentialRefreshTimeout)
			newKey, _, err := RefreshCodexChannelCredential(refreshCtx, ch.Id, CodexCredentialRefreshOptions{ResetCaches: false})
			cancel()
			if err != nil {
				logger.LogWarn(ctx, fmt.Sprintf(i18n.Translate("svc.codex_credential_auto_refresh_channel_id_name"), ch.Id, ch.Name, err))
				continue
			}

			refreshed++
			logger.LogInfo(ctx, fmt.Sprintf("codex credential auto-refresh: channel_id=%d name=%s refreshed, expires_at=%s", ch.Id, ch.Name, newKey.Expired))
		}
	}

	if refreshed > 0 {
		func() {
			defer func() {
				if r := recover(); r != nil {
					logger.LogWarn(ctx, fmt.Sprintf(i18n.Translate("svc.codex_credential_auto_refresh_initchannelcache_panic"), r))
				}
			}()
			model.InitChannelCache()
		}()
		ResetProxyClientCache()
	}

	if common.DebugEnabled {
		logger.LogDebug(ctx, i18n.Translate("svc.codex_credential_auto_refresh_scanned_refreshed"), scanned, refreshed)
	}
}
