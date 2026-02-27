package channeltest

import (
	"fmt"
	"net/http/httptest"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	TriggerManual = "manual"
	TriggerAuto   = "auto"

	ScopeSingleChannel = "single_channel"
	ScopeAutoDisabled  = "auto_disabled"
)

func BuildChannelTestLogContext(base *gin.Context) *gin.Context {
	if base != nil {
		return base
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if cache, err := model.GetUserCache(1); err == nil {
		cache.WriteContext(c)
	}
	if group, err := model.GetUserGroup(1, false); err == nil && group != "" {
		c.Set("group", group)
	}
	c.Set("username", "root")
	return c
}

func PrepareChannelTestContext(base *gin.Context) *gin.Context {
	ctx := BuildChannelTestLogContext(base)
	if ctx.GetString("token_name") == "" {
		ctx.Set("token_name", "模型测试")
	}
	return ctx
}

func channelTestModelName(channel *model.Channel) string {
	if channel == nil {
		return ""
	}
	if channel.TestModel != nil {
		testModel := strings.TrimSpace(*channel.TestModel)
		if testModel != "" {
			return testModel
		}
	}
	models := channel.GetModels()
	if len(models) > 0 {
		return strings.TrimSpace(models[0])
	}
	return ""
}

func RecordChannelTestErrorLog(base *gin.Context, channel *model.Channel, modelName string, trigger string, scope string, useTimeSeconds int, isStream bool, err error) {
	if !constant.ErrorLogEnabled || channel == nil {
		return
	}
	context := PrepareChannelTestContext(base)
	if strings.TrimSpace(modelName) == "" {
		modelName = channelTestModelName(channel)
	}
	group := context.GetString("group")
	if group == "" {
		group, _ = model.GetUserGroup(1, false)
	}
	content := "模型测试失败"
	if err != nil && err.Error() != "" {
		content = fmt.Sprintf("模型测试失败: %s", err.Error())
	}
	other := map[string]interface{}{
		"channel_test":         true,
		"channel_test_scope":   scope,
		"channel_test_trigger": trigger,
		"channel_test_result":  "failed",
	}
	if err != nil {
		other["channel_test_error"] = err.Error()
	}
	model.RecordErrorLog(context, 1, channel.Id, modelName, "模型测试", content, 0, useTimeSeconds, isStream, group, other)
}

func MarkChannelTestOther(other map[string]interface{}) map[string]interface{} {
	if other == nil {
		other = make(map[string]interface{})
	}
	other["channel_test"] = true
	return other
}
