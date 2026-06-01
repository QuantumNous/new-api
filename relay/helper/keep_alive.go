package helper

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

const (
	DefaultImageKeepAliveInterval = 25 * time.Second

	processingKeepAliveContextKey = "http_processing_keepalive"
)

type processingKeepAlive struct {
	cancel context.CancelFunc
	done   chan struct{}
	once   sync.Once
}

func isImageRelayMode(mode int) bool {
	return mode == relayconstant.RelayModeImagesGenerations || mode == relayconstant.RelayModeImagesEdits
}

func RelayPingConfig(info *relaycommon.RelayInfo, generalSettings *operation_setting.GeneralSetting) (bool, time.Duration) {
	if info == nil || info.DisablePing {
		return false, DefaultPingInterval
	}

	imageMode := isImageRelayMode(info.RelayMode)
	pingEnabled := imageMode
	if generalSettings != nil && generalSettings.PingIntervalEnabled {
		pingEnabled = true
	}
	if !pingEnabled {
		return false, DefaultPingInterval
	}

	interval := DefaultPingInterval
	if generalSettings != nil && generalSettings.PingIntervalSeconds > 0 {
		interval = time.Duration(generalSettings.PingIntervalSeconds) * time.Second
	}
	if imageMode {
		if generalSettings == nil || !generalSettings.PingIntervalEnabled || interval > time.Minute {
			interval = DefaultImageKeepAliveInterval
		}
	}
	if interval <= 0 {
		interval = DefaultPingInterval
	}
	return true, interval
}

func StartProcessingKeepAlive(c *gin.Context, interval time.Duration) func() {
	if c == nil || c.Writer == nil || c.Request == nil || interval <= 0 {
		return func() {}
	}

	ctx, cancel := context.WithCancel(c.Request.Context())
	keepAlive := &processingKeepAlive{
		cancel: cancel,
		done:   make(chan struct{}),
	}
	c.Set(processingKeepAliveContextKey, keepAlive)

	go func() {
		defer close(keepAlive.done)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := WriteProcessing(c); err != nil {
					logger.LogDebug(c, "HTTP 102 keepalive stopped: %s", err.Error())
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	return func() {
		StopProcessingKeepAlive(c)
	}
}

func StopProcessingKeepAlive(c *gin.Context) {
	if c == nil {
		return
	}
	value, ok := c.Get(processingKeepAliveContextKey)
	if !ok || value == nil {
		return
	}
	keepAlive, ok := value.(*processingKeepAlive)
	if !ok || keepAlive == nil {
		return
	}
	keepAlive.once.Do(func() {
		keepAlive.cancel()
		select {
		case <-keepAlive.done:
		case <-time.After(5 * time.Second):
			logger.LogDebug(c, "timeout waiting for HTTP 102 keepalive to stop")
		}
		c.Set(processingKeepAliveContextKey, nil)
	})
}

func WriteProcessing(c *gin.Context) error {
	if c == nil || c.Writer == nil {
		return errors.New("context or writer is nil")
	}
	if c.Request != nil && c.Request.Context().Err() != nil {
		return fmt.Errorf("request context done: %w", c.Request.Context().Err())
	}
	if c.Writer.Written() {
		return errors.New("response already written")
	}

	target := http.ResponseWriter(c.Writer)
	if unwrapper, ok := c.Writer.(interface{ Unwrap() http.ResponseWriter }); ok {
		target = unwrapper.Unwrap()
	}
	if target == nil {
		return errors.New("underlying response writer is nil")
	}

	target.WriteHeader(http.StatusProcessing)
	if flusher, ok := target.(http.Flusher); ok {
		flusher.Flush()
	}
	return nil
}
