package service

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useDesktopAuthorizationRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	previousEnabled, previousClient := common.RedisEnabled, common.RDB
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	common.RedisEnabled = true
	common.RDB = client
	t.Cleanup(func() {
		_ = client.Close()
		common.RedisEnabled = previousEnabled
		common.RDB = previousClient
	})
	return server
}

func desktopAuthorizationErrorCode(t *testing.T, err error) string {
	t.Helper()
	var flowErr *DesktopDeviceAuthorizationError
	require.ErrorAs(t, err, &flowErr)
	return flowErr.Code
}

func TestDesktopDeviceAuthorizationHappyPathAndReplay(t *testing.T) {
	useTestSessionSecret(t)
	user := setupAuthSessionTestDB(t)
	useDesktopAuthorizationRedis(t)

	view, err := CreateDesktopDeviceAuthorization("野菜API Desktop", "https://yeschoy.com/")
	require.NoError(t, err)
	assert.Len(t, view.DeviceCode, 64)
	assert.Regexp(t, `^[A-Z0-9]{4}-[A-Z0-9]{4}$`, view.UserCode)
	assert.Equal(t, "https://yeschoy.com/desktop-authorize", view.VerificationURI)
	assert.Equal(t, DesktopDeviceAuthorizationExpiresIn, view.ExpiresIn)

	status, clientName, err := DecideDesktopDeviceAuthorization(view.UserCode, "approve", user.Id, user.AuthVersion)
	require.NoError(t, err)
	assert.Equal(t, desktopAuthorizationApproved, status)
	assert.Equal(t, "野菜API Desktop", clientName)

	bundle, err := ExchangeDesktopDeviceAuthorization(view.DeviceCode, "127.0.0.1", "desktop-test")
	require.NoError(t, err)
	assert.NotEmpty(t, bundle.AccessToken)
	assert.NotEmpty(t, bundle.RefreshToken)
	assert.Equal(t, "desktop_device", bundle.Session.LoginMethod)

	var stored model.UserSession
	require.NoError(t, model.DB.First(&stored, "sid = ?", bundle.Session.SID).Error)
	assert.Equal(t, user.Id, stored.UserID)
	assert.Equal(t, "desktop_device", stored.LoginMethod)

	_, err = ExchangeDesktopDeviceAuthorization(view.DeviceCode, "127.0.0.1", "desktop-test")
	assert.Equal(t, "already_used", desktopAuthorizationErrorCode(t, err))
}

func TestDesktopDeviceAuthorizationPendingSlowDownDeniedAndExpiry(t *testing.T) {
	useTestSessionSecret(t)
	user := setupAuthSessionTestDB(t)
	server := useDesktopAuthorizationRedis(t)

	view, err := CreateDesktopDeviceAuthorization("desktop", "https://yeschoy.com")
	require.NoError(t, err)
	_, err = ExchangeDesktopDeviceAuthorization(view.DeviceCode, "127.0.0.1", "desktop-test")
	assert.Equal(t, "authorization_pending", desktopAuthorizationErrorCode(t, err))
	_, err = ExchangeDesktopDeviceAuthorization(view.DeviceCode, "127.0.0.1", "desktop-test")
	assert.Equal(t, "slow_down", desktopAuthorizationErrorCode(t, err))

	status, _, err := DecideDesktopDeviceAuthorization(view.UserCode, "deny", user.Id, user.AuthVersion)
	require.NoError(t, err)
	assert.Equal(t, desktopAuthorizationDenied, status)
	_, err = ExchangeDesktopDeviceAuthorization(view.DeviceCode, "127.0.0.1", "desktop-test")
	assert.Equal(t, "access_denied", desktopAuthorizationErrorCode(t, err))

	expiring, err := CreateDesktopDeviceAuthorization("desktop", "https://yeschoy.com")
	require.NoError(t, err)
	server.FastForward((DesktopDeviceAuthorizationExpiresIn + 1) * time.Second)
	_, err = ExchangeDesktopDeviceAuthorization(expiring.DeviceCode, "127.0.0.1", "desktop-test")
	assert.Equal(t, "expired_token", desktopAuthorizationErrorCode(t, err))

	_, _, err = DecideDesktopDeviceAuthorization("bad-code", "approve", user.Id, user.AuthVersion)
	assert.Equal(t, "invalid_request", desktopAuthorizationErrorCode(t, err))
}

func TestDesktopDeviceAuthorizationConcurrentExchangeCreatesOneSession(t *testing.T) {
	useTestSessionSecret(t)
	user := setupAuthSessionTestDB(t)
	useDesktopAuthorizationRedis(t)
	view, err := CreateDesktopDeviceAuthorization("desktop", "https://yeschoy.com")
	require.NoError(t, err)
	_, _, err = DecideDesktopDeviceAuthorization(view.UserCode, "approve", user.Id, user.AuthVersion)
	require.NoError(t, err)

	const workers = 8
	results := make(chan error, workers)
	var waitGroup sync.WaitGroup
	for range workers {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			_, exchangeErr := ExchangeDesktopDeviceAuthorization(view.DeviceCode, "127.0.0.1", "desktop-test")
			results <- exchangeErr
		}()
	}
	waitGroup.Wait()
	close(results)

	successes := 0
	for exchangeErr := range results {
		if exchangeErr == nil {
			successes++
			continue
		}
		var flowErr *DesktopDeviceAuthorizationError
		require.True(t, errors.As(exchangeErr, &flowErr))
		assert.Equal(t, "already_used", flowErr.Code)
	}
	assert.Equal(t, 1, successes)
	var count int64
	require.NoError(t, model.DB.Model(&model.UserSession{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestDesktopDeviceAuthorizationRequiresRedis(t *testing.T) {
	previousEnabled, previousClient := common.RedisEnabled, common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		common.RedisEnabled = previousEnabled
		common.RDB = previousClient
	})

	_, err := CreateDesktopDeviceAuthorization("desktop", "https://yeschoy.com")
	assert.Equal(t, "temporarily_unavailable", desktopAuthorizationErrorCode(t, err))
}
