package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSelectChannelForCurrentRetry_SkipsGovernorRejectedChannel(t *testing.T) {
	restoreSetup := swapSetupContextForTest(func(c *gin.Context, channel *model.Channel, modelName string) *types.NewAPIError {
		if channel.Id == 11 {
			return types.NewErrorWithStatusCode(
				errors.New("channel is cooling"),
				types.ErrorCodeGovernorSelectionRejected,
				http.StatusTooManyRequests,
				types.ErrOptionWithSkipRetry(),
				types.ErrOptionWithNoRecordErrorLog(),
			)
		}
		common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
		common.SetContextKey(c, constant.ContextKeyChannelKey, channel.Key)
		return nil
	})
	defer restoreSetup()

	restoreSelector := swapSelectChannelForTest(func(param *service.RetryParam) (*model.Channel, string, error) {
		if !param.IsExcluded(11) {
			return &model.Channel{
				Id:     11,
				Name:   "cooling",
				Key:    "k1",
				Status: common.ChannelStatusEnabled,
			}, "default", nil
		}
		return &model.Channel{
			Id:     22,
			Name:   "healthy",
			Key:    "k2",
			Status: common.ChannelStatusEnabled,
		}, "default", nil
	})
	defer restoreSelector()

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o"}`))

	param := &service.RetryParam{
		Ctx:        ctx,
		TokenGroup: "default",
		ModelName:  "gpt-4o",
		Retry:      common.GetPointer(0),
	}

	channel, _, apiErr := SelectChannelForCurrentRetry(ctx, param, "gpt-4o")
	require.Nil(t, apiErr)
	require.NotNil(t, channel)
	require.Equal(t, 22, channel.Id)
	require.True(t, param.IsExcluded(11))
	require.Equal(t, 22, common.GetContextKeyInt(ctx, constant.ContextKeyChannelId))
}
