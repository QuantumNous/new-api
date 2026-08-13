package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestValidateChannelRejectsCopilotMultiKey(t *testing.T) {
	channel := &model.Channel{
		Type: constant.ChannelTypeCopilot,
		Key:  "github-token",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
		},
	}

	require.EqualError(t, validateChannel(channel, true), "Copilot channel does not support multi-key mode")
}

func TestValidateChannelAllowsEmptyCopilotCredentialOnCreate(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeCopilot}

	require.NoError(t, validateChannel(channel, true))
}

func TestUpdateChannelRejectsTransitionFromMultiKeyToCopilot(t *testing.T) {
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	origin := model.Channel{Id: 1, Type: constant.ChannelTypeOpenAI, Key: "key-a\nkey-b", Name: "multi", Models: "gpt-4", Group: "default", Status: common.ChannelStatusEnabled, ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2}}
	require.NoError(t, db.Create(&origin).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/channel", bytes.NewBufferString(`{"id":1,"type":112}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	UpdateChannel(ctx)

	require.Contains(t, recorder.Body.String(), "Copilot channel does not support multi-key mode")
	var stored model.Channel
	require.NoError(t, db.First(&stored, 1).Error)
	require.Equal(t, constant.ChannelTypeOpenAI, stored.Type)
}
