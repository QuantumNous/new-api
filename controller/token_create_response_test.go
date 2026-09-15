package controller

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAddTokenReturnsCreatedMaskedIdentity(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", map[string]any{
		"name": "daily", "group": "default", "unlimited_quota": true, "expired_time": -1,
	}, 42)

	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	require.NotEmpty(t, response.Data, "successful creation must identify the new token")
	var created tokenResponseItem
	require.NoError(t, common.Unmarshal(response.Data, &created))
	var stored model.Token
	require.NoError(t, db.First(&stored, created.ID).Error)
	assert.Equal(t, "daily", created.Name)
	assert.Equal(t, stored.GetMaskedKey(), created.Key)
	assert.NotEqual(t, stored.Key, created.Key)
	assert.Equal(t, 42, stored.UserId)

	revealContext, revealRecorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/key", nil, 42)
	revealContext.Params = gin.Params{{Key: "id", Value: strconv.Itoa(created.ID)}}
	GetTokenKey(revealContext)
	var revealed tokenKeyResponse
	require.NoError(t, common.Unmarshal(decodeAPIResponse(t, revealRecorder).Data, &revealed))
	assert.Equal(t, stored.Key, revealed.Key)
}
