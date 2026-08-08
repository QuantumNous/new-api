package service

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	AssetMaterializeErrorThrottled   = "throttled"
	AssetMaterializeErrorTimeout     = "timeout"
	AssetMaterializeErrorUpstream5xx = "upstream_5xx"
	AssetMaterializeErrorProcessing  = "upstream_processing"
	AssetMaterializeErrorDefinitive  = "definitive"
	AssetMaterializeErrorInternal    = "internal"

	assetMaterializeMaxRetryAfter = 24 * time.Hour
)

type AssetMaterializeFailure struct {
	Class        string
	HTTPStatus   int
	UpstreamCode string
	RetryAfter   time.Duration
	RequestID    string
	cause        error
}

func (e *AssetMaterializeFailure) Error() string {
	return "asset upstream request failed"
}

func (e *AssetMaterializeFailure) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.cause
}

func IsRetryableAssetMaterializeError(err error) bool {
	class := AssetMaterializeErrorClass(err)
	switch class {
	case AssetMaterializeErrorThrottled, AssetMaterializeErrorTimeout, AssetMaterializeErrorUpstream5xx, AssetMaterializeErrorProcessing:
		return true
	default:
		return false
	}
}

func AssetMaterializeErrorClass(err error) string {
	if err == nil {
		return ""
	}
	var failure *AssetMaterializeFailure
	if errors.As(err, &failure) {
		class := strings.TrimSpace(failure.Class)
		if class != "" {
			return class
		}
	}
	if errors.Is(err, context.DeadlineExceeded) || isNetTimeout(err) {
		return AssetMaterializeErrorTimeout
	}
	return AssetMaterializeErrorInternal
}

func newAssetMaterializeFailure(class string, status int, upstreamCode string, retryAfter time.Duration, requestID string, cause error) *AssetMaterializeFailure {
	return &AssetMaterializeFailure{
		Class:        class,
		HTTPStatus:   status,
		UpstreamCode: strings.TrimSpace(upstreamCode),
		RetryAfter:   retryAfter,
		RequestID:    strings.TrimSpace(requestID),
		cause:        cause,
	}
}

func assetMaterializeClassForHTTPStatus(status int, upstreamCode string) string {
	code := strings.TrimSpace(upstreamCode)
	if status == http.StatusTooManyRequests || code == "QuotaWriteQPMExceeded" {
		return AssetMaterializeErrorThrottled
	}
	if status == http.StatusRequestTimeout {
		return AssetMaterializeErrorTimeout
	}
	if status >= 500 && status <= 599 {
		return AssetMaterializeErrorUpstream5xx
	}
	if status >= 400 && status <= 499 {
		return AssetMaterializeErrorDefinitive
	}
	return AssetMaterializeErrorInternal
}

func parseAssetMaterializeRetryAfter(value string, now time.Time) time.Duration {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	if seconds, err := strconv.ParseInt(value, 10, 64); err == nil {
		if seconds <= 0 {
			return 0
		}
		if seconds > int64(assetMaterializeMaxRetryAfter/time.Second) {
			return assetMaterializeMaxRetryAfter
		}
		return time.Duration(seconds) * time.Second
	}
	when, err := http.ParseTime(value)
	if err != nil {
		return 0
	}
	delay := when.Sub(now)
	if delay <= 0 {
		return 0
	}
	if delay > assetMaterializeMaxRetryAfter {
		return assetMaterializeMaxRetryAfter
	}
	return delay
}

func isNetTimeout(err error) bool {
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}
