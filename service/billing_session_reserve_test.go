package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBillingSessionReserveRechecksWalletBeforeHigherCandidate(t *testing.T) {
	truncate(t)
	const userID = 30001
	seedUser(t, userID, 1000)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		UserId:          userID,
		IsPlayground:    true,
		UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
		ForcePreConsume: true,
	}

	session, apiErr := NewBillingSession(c, info, 100)
	require.Nil(t, apiErr)
	require.NotNil(t, session)
	require.NoError(t, session.Reserve(250))
	assert.Equal(t, 250, session.GetPreConsumedQuota())

	userQuota, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, 750, userQuota)
}

func TestBillingSessionReserveRejectsInsufficientWalletForHigherCandidate(t *testing.T) {
	truncate(t)
	const userID = 30002
	seedUser(t, userID, 200)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		UserId:          userID,
		IsPlayground:    true,
		UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
		ForcePreConsume: true,
	}

	session, apiErr := NewBillingSession(c, info, 100)
	require.Nil(t, apiErr)
	require.NotNil(t, session)

	reserveErr := session.Reserve(250)
	var apiReserveErr *types.NewAPIError
	require.ErrorAs(t, reserveErr, &apiReserveErr)
	assert.Equal(t, types.ErrorCodeInsufficientUserQuota, apiReserveErr.GetErrorCode())
	assert.Equal(t, 100, session.GetPreConsumedQuota())

	userQuota, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, 100, userQuota)
}

func TestBillingSessionReserveRechecksTrustedWalletForHigherCandidate(t *testing.T) {
	truncate(t)
	const userID = 30003
	initialQuota := common.GetTrustQuota() + 100
	seedUser(t, userID, initialQuota)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenUnlimited:  true,
		IsPlayground:    true,
		UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
		ForcePreConsume: false,
	}

	session, apiErr := NewBillingSession(c, info, 50)
	require.Nil(t, apiErr)
	require.NotNil(t, session)
	assert.Equal(t, 0, session.GetPreConsumedQuota())

	reserveErr := session.Reserve(initialQuota + 1)
	var apiReserveErr *types.NewAPIError
	require.ErrorAs(t, reserveErr, &apiReserveErr)
	assert.Equal(t, types.ErrorCodeInsufficientUserQuota, apiReserveErr.GetErrorCode())
	assert.Equal(t, 0, session.GetPreConsumedQuota())

	userQuota, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, initialQuota, userQuota)
}
