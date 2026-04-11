package governor

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type managerTestStore struct {
	acquireErr   error
	allowRPM     bool
	allowRPMErr  error
	releaseCalls []leaseCall
	coolKeyCalls []coolCall
	coolChCalls  []coolCall
}

type leaseCall struct {
	channelID     int
	keyIndex      int
	reservationID string
}

type coolCall struct {
	channelID int
	keyIndex  int
	ttl       time.Duration
}

func (s *managerTestStore) IsChannelCooling(_ context.Context, _ int) (bool, time.Duration, error) {
	return false, 0, nil
}

func (s *managerTestStore) IsKeyCooling(_ context.Context, _ int, _ int) (bool, time.Duration, error) {
	return false, 0, nil
}

func (s *managerTestStore) AllowChannelRPM(_ context.Context, _ int, _ int64) (bool, error) {
	if s.allowRPMErr != nil {
		return false, s.allowRPMErr
	}
	if s.allowRPM {
		return true, nil
	}
	return true, nil
}

func (s *managerTestStore) AcquireKeyLease(_ context.Context, _ int, _ int, _ string, _ int64, _ time.Duration) (bool, error) {
	if s.acquireErr != nil {
		return false, s.acquireErr
	}
	return true, nil
}

func (s *managerTestStore) TouchKeyLease(_ context.Context, _ int, _ int, _ string, _ time.Duration) error {
	return nil
}

func (s *managerTestStore) ReleaseKeyLease(_ context.Context, channelID int, keyIndex int, reservationID string) error {
	s.releaseCalls = append(s.releaseCalls, leaseCall{channelID: channelID, keyIndex: keyIndex, reservationID: reservationID})
	return nil
}

func (s *managerTestStore) CoolChannel(_ context.Context, channelID int, ttl time.Duration) error {
	s.coolChCalls = append(s.coolChCalls, coolCall{channelID: channelID, ttl: ttl})
	return nil
}

func (s *managerTestStore) CoolKey(_ context.Context, channelID int, keyIndex int, ttl time.Duration) error {
	s.coolKeyCalls = append(s.coolKeyCalls, coolCall{channelID: channelID, keyIndex: keyIndex, ttl: ttl})
	return nil
}

func TestCompleteRelayAttemptFromContext_ReleasesLeaseAndCoolsKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	store := &managerTestStore{}
	restoreStore := SetStoreFactoryForTest(func() Store { return store })
	defer restoreStore()

	common.SetContextKey(c, constant.ContextKeyGovernorAttempt, &AttemptState{
		ChannelID:           7,
		KeyIndex:            1,
		ReservationID:       "lease-1",
		LeaseHeld:           true,
		ApplyKeyConcurrency: true,
		Config: Config{
			Enabled:               true,
			KeyCooldownSeconds:    11,
			KeyCooldownOnStatuses: []int{429},
			RespectRetryAfter:     true,
		},
	})

	apiErr := types.NewOpenAIError(
		errors.New("rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
		types.ErrOptionWithRetryAfter("19"),
	)
	CompleteRelayAttemptFromContext(c, apiErr)

	require.Len(t, store.releaseCalls, 1)
	require.Equal(t, leaseCall{channelID: 7, keyIndex: 1, reservationID: "lease-1"}, store.releaseCalls[0])
	require.Len(t, store.coolKeyCalls, 1)
	require.Equal(t, 7, store.coolKeyCalls[0].channelID)
	require.Equal(t, 1, store.coolKeyCalls[0].keyIndex)
	require.Equal(t, 19*time.Second, store.coolKeyCalls[0].ttl)
	require.Len(t, store.coolChCalls, 0)
	_, exists := c.Get(string(constant.ContextKeyGovernorAttempt))
	require.False(t, exists)
}

func TestCompleteTaskAttemptFromContext_ReleasesLeaseButSkipsKeyConcurrencyCooling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	store := &managerTestStore{}
	restoreStore := SetStoreFactoryForTest(func() Store { return store })
	defer restoreStore()

	common.SetContextKey(c, constant.ContextKeyGovernorAttempt, &AttemptState{
		ChannelID:           9,
		KeyIndex:            0,
		ReservationID:       "lease-task",
		LeaseHeld:           true,
		ApplyKeyConcurrency: false,
		Config: Config{
			Enabled:                   true,
			ChannelCooldownSeconds:    25,
			ChannelCooldownOnStatuses: []int{429},
		},
	})

	taskErr := &dto.TaskError{
		Code:       "fail_to_fetch_task",
		Message:    "rate limited",
		StatusCode: http.StatusTooManyRequests,
		Error:      errors.New("rate limited"),
	}
	CompleteTaskAttemptFromContext(c, taskErr)

	require.Len(t, store.releaseCalls, 1)
	require.Equal(t, leaseCall{channelID: 9, keyIndex: 0, reservationID: "lease-task"}, store.releaseCalls[0])
	require.Len(t, store.coolChCalls, 1)
	require.Equal(t, 9, store.coolChCalls[0].channelID)
	require.Equal(t, 25*time.Second, store.coolChCalls[0].ttl)
	require.Len(t, store.coolKeyCalls, 0)
	_, exists := c.Get(string(constant.ContextKeyGovernorAttempt))
	require.False(t, exists)
}

func TestPrepareAttemptForChannel_RPMStoreErrorStopsHeartbeatAndReturnsInfraError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	store := &managerTestStore{allowRPMErr: errors.New("redis unavailable")}
	restoreStore := SetStoreFactoryForTest(func() Store { return store })
	defer restoreStore()

	cancelCalls := 0
	previousStarter := leaseHeartbeatStarter
	leaseHeartbeatStarter = func(parent context.Context, store Store, channelID int, keyIndex int, reservationID string, leaseTTL time.Duration, interval time.Duration) context.CancelFunc {
		return func() {
			cancelCalls++
		}
	}
	defer func() {
		leaseHeartbeatStarter = previousStarter
	}()

	channel := buildGovernorManagedChannelForTest()
	_, _, apiErr := PrepareAttemptForChannel(c, channel)

	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeGetChannelFailed, apiErr.GetErrorCode())
	require.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
	require.Equal(t, 1, cancelCalls)
	require.Len(t, store.releaseCalls, 1)
	require.False(t, getAttemptFromContext(c) != nil)
}

func TestPrepareAttemptForChannel_AcquireLeaseErrorReturnsInfraError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	store := &managerTestStore{acquireErr: errors.New("redis unavailable")}
	restoreStore := SetStoreFactoryForTest(func() Store { return store })
	defer restoreStore()

	channel := buildGovernorManagedChannelForTest()
	_, _, apiErr := PrepareAttemptForChannel(c, channel)

	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeGetChannelFailed, apiErr.GetErrorCode())
	require.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
	require.Empty(t, store.releaseCalls)
}

func buildGovernorManagedChannelForTest() *model.Channel {
	channel := &model.Channel{
		Id:     21,
		Name:   "governed",
		Key:    "k1",
		Status: common.ChannelStatusEnabled,
	}
	channel.SetSetting(dto.ChannelSettings{
		Governor: &dto.GovernorSettings{
			Enabled:                     true,
			ChannelMaxRPM:               1,
			KeyMaxConcurrency:           1,
			ReservationLeaseSeconds:     30,
			ReservationHeartbeatSeconds: 5,
		},
	})
	return channel
}
