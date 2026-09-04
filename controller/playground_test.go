package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetupPlaygroundRelayContextUsesResolvedGroup(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1005,
		Username: "playground-image-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)

	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("id", 1005)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "vip")

	err := setupPlaygroundRelayContext(ctx, &relaycommon.RelayInfo{UsingGroup: "vip"})

	require.Nil(t, err)
	assert.Equal(t, "vip", common.GetContextKeyString(ctx, constant.ContextKeyTokenGroup))
	assert.Equal(t, "playground-vip", ctx.GetString("token_name"))
}
