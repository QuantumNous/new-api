package service

import (
	"context"
	"errors"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestAssetMaterializeFailureRetryableClassification(t *testing.T) {
	err := &AssetMaterializeFailure{
		Class:        AssetMaterializeErrorThrottled,
		HTTPStatus:   429,
		UpstreamCode: "QuotaWriteQPMExceeded",
		RetryAfter:   15 * time.Second,
		RequestID:    "req-rate-limit",
		cause:        context.DeadlineExceeded,
	}

	require.Equal(t, "asset upstream request failed", err.Error())
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.True(t, IsRetryableAssetMaterializeError(err))
	require.Equal(t, AssetMaterializeErrorThrottled, AssetMaterializeErrorClass(err))
}

func TestAssetMaterializeFailureTimeoutWrapping(t *testing.T) {
	timeoutErr := &net.DNSError{IsTimeout: true, Err: "provider timeout"}
	err := &AssetMaterializeFailure{Class: AssetMaterializeErrorTimeout, cause: timeoutErr}

	require.True(t, IsRetryableAssetMaterializeError(err))
	require.True(t, errors.Is(err, timeoutErr))
	require.Equal(t, AssetMaterializeErrorTimeout, AssetMaterializeErrorClass(err))
}

func TestAssetMaterializeErrorClassDefaultsInternal(t *testing.T) {
	require.False(t, IsRetryableAssetMaterializeError(errors.New("local upload failed")))
	require.Equal(t, AssetMaterializeErrorInternal, AssetMaterializeErrorClass(errors.New("local upload failed")))
}

func TestAssetMaterializeRetryAfterIgnoresNonPositiveAndExpiredValues(t *testing.T) {
	now := time.Date(2026, 8, 8, 1, 0, 0, 0, time.UTC)

	require.Zero(t, parseAssetMaterializeRetryAfter("-5", now))
	require.Zero(t, parseAssetMaterializeRetryAfter("0", now))
	require.Zero(t, parseAssetMaterializeRetryAfter(now.Add(-time.Minute).Format(http.TimeFormat), now))
}

func TestAssetMaterializeRequestTimeoutHTTPStatusIsRetryable(t *testing.T) {
	require.Equal(t, AssetMaterializeErrorTimeout, assetMaterializeClassForHTTPStatus(http.StatusRequestTimeout, ""))
}

func TestAssetMaterializeRetryAfterCapsNumericValueBeforeDurationConversion(t *testing.T) {
	now := time.Date(2026, 8, 8, 1, 0, 0, 0, time.UTC)

	require.Equal(t, 24*time.Hour, parseAssetMaterializeRetryAfter("9223372036854775807", now))
}

func TestAssetMaterializeRetryAfterCapsFarFutureHTTPDate(t *testing.T) {
	now := time.Date(2026, 8, 8, 1, 0, 0, 0, time.UTC)
	farFuture := now.Add(90 * 24 * time.Hour).Format(http.TimeFormat)

	require.Equal(t, 24*time.Hour, parseAssetMaterializeRetryAfter(farFuture, now))
}

func TestAssetMaterializeHTTPClassificationTreatsStableQuotaCodeAsThrottled(t *testing.T) {
	require.Equal(t, AssetMaterializeErrorThrottled, assetMaterializeClassForHTTPStatus(http.StatusBadRequest, "QuotaWriteQPMExceeded"))
	require.Equal(t, AssetMaterializeErrorDefinitive, assetMaterializeClassForHTTPStatus(http.StatusBadRequest, "InvalidAsset"))
}
