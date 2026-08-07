package controller

import (
	"bytes"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func imageAutoMultipartContext(t *testing.T, fields []string) *gin.Context {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for index, field := range fields {
		part, err := writer.CreateFormFile(field, fmt.Sprintf("ref-%d.png", index+1))
		require.NoError(t, err)
		_, err = part.Write([]byte("image"))
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return c
}

func TestCountImageAutoReferenceImagesSupportsStandardArrayAndIndexedFields(t *testing.T) {
	c := imageAutoMultipartContext(t, []string{"image", "image[]", "image[]", "image[3]", "image[-1]", "image[name]"})
	count, err := countImageAutoReferenceImages(c)
	require.NoError(t, err)
	require.Equal(t, 4, count)
}

func TestPrepareImageAutoRequestRejectsIncapableRoutesBeforePreConsume(t *testing.T) {
	setImageRoutingOptionForControllerTest(t, `{
  "version":1,"revision":7,"enabled":true,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"single","channel_id":36,"priority":1,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000}]
}`)
	c := imageAutoMultipartContext(t, []string{"image[]", "image[]"})
	info := &relaycommon.RelayInfo{
		OriginModelName: imageAutoPublicModel,
		RelayMode:       relayconstant.RelayModeImagesEdits,
		Request:         &dto.ImageRequest{Model: imageAutoPublicModel, Prompt: "edit"},
	}

	handled, err := prepareImageAutoRequest(c, info)
	require.False(t, handled)
	require.ErrorContains(t, err, "support 2 reference images")
	require.False(t, info.ForcePreConsume)
	require.Nil(t, info.ImageRouting)
}

func setImageRoutingOptionForControllerTest(t *testing.T, value string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = map[string]string{setting.ImageRoutingConfigOption: value}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = original
		common.OptionMapRWMutex.Unlock()
	})
}

func TestPrepareImageAutoRequestSupportsImageEdits(t *testing.T) {
	setImageRoutingOptionForControllerTest(t, `{
  "version":1,"revision":7,"enabled":true,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"alt","channel_id":36,"priority":1,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000}]
}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/edits", nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: imageAutoPublicModel,
		RelayMode:       relayconstant.RelayModeImagesEdits,
		Request: &dto.ImageRequest{
			Model:   imageAutoPublicModel,
			Prompt:  "edit this image",
			Quality: "standard",
		},
	}

	enabled, err := prepareImageAutoRequest(c, info)

	require.True(t, enabled)
	require.NoError(t, err)
	require.NotNil(t, info.ImageRouting)
	require.Equal(t, "medium", info.Request.(*dto.ImageRequest).Quality)
}

func TestPrepareImageAutoRequestRecoversPublicModelFromImageRequest(t *testing.T) {
	setImageRoutingOptionForControllerTest(t, `{
  "version":1,"revision":7,"enabled":true,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"alt","channel_id":36,"priority":1,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000}]
}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{
		Request:    &dto.ImageRequest{Model: imageAutoPublicModel, Prompt: "test"},
		UsingGroup: "imageauto",
	}

	handled, err := prepareImageAutoRequest(c, info)

	require.NoError(t, err)
	require.True(t, handled)
	require.Equal(t, imageAutoPublicModel, info.OriginModelName)
	require.NotNil(t, info.ImageRouting)
}

func TestPrepareImageAutoRequestFreezesPlanAndReserve(t *testing.T) {
	setImageRoutingOptionForControllerTest(t, `{
  "version":1,"revision":42,"enabled":true,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[
    {"id":"alt","channel_id":36,"priority":2,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000},
    {"id":"enterprise","channel_id":108,"priority":1,"enabled":true,"billing_mode":"metered","upstream_model":"gpt-image-2","billing_model":"gpt-image-2","billing_group":"GPT企业旗舰","reserve_quota_by_quality":{"low":400000,"medium":800000,"high":2000000},"missing_usage_quota_by_quality":{"low":100000,"medium":400000,"high":1600000}}
  ]
}`)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)
	n := uint(2)
	request := &dto.ImageRequest{Model: "image-auto", Prompt: "test", Quality: "standard", N: &n}
	info := &relaycommon.RelayInfo{OriginModelName: "image-auto", Request: request, UsingGroup: "imageauto"}

	handled, err := prepareImageAutoRequest(c, info)
	require.NoError(t, err)
	require.True(t, handled)
	require.True(t, info.ForcePreConsume)
	require.NotNil(t, info.ImageRouting)
	require.Equal(t, 42, info.ImageRouting.Plan.Revision)
	require.Equal(t, "medium", request.Quality)
	require.Equal(t, 1600000, info.PriceData.QuotaToPreConsume)
}

func TestPrepareImageAutoRequestRejectsExplicitZeroOrTooManyImages(t *testing.T) {
	setImageRoutingOptionForControllerTest(t, `{
  "version":1,"revision":1,"enabled":true,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"alt","channel_id":36,"priority":1,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000}]
}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)

	zero := uint(0)
	_, err := prepareImageAutoRequest(c, &relaycommon.RelayInfo{
		OriginModelName: "image-auto",
		Request:         &dto.ImageRequest{Model: "image-auto", Prompt: "test", N: &zero},
	})
	require.ErrorContains(t, err, "n")

	five := uint(5)
	_, err = prepareImageAutoRequest(c, &relaycommon.RelayInfo{
		OriginModelName: "image-auto",
		Request:         &dto.ImageRequest{Model: "image-auto", Prompt: "test", N: &five},
	})
	require.ErrorContains(t, err, "n")
}

func TestPrepareImageAutoRequestFailsClosedWhenRoutingIsMissing(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = original
		common.OptionMapRWMutex.Unlock()
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: "image-auto",
		Request:         &dto.ImageRequest{Model: "image-auto", Prompt: "test"},
	}
	handled, err := prepareImageAutoRequest(c, info)
	require.False(t, handled)
	require.ErrorIs(t, err, setting.ErrImageRoutingUnavailable)
	require.Nil(t, info.ImageRouting)
}

func TestPrepareImageAutoRequestFailsClosedWhenRoutingIsDisabled(t *testing.T) {
	setImageRoutingOptionForControllerTest(t, `{
  "version":1,"revision":1,"enabled":false,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"alt","channel_id":36,"priority":1,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000}]
}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)
	handled, err := prepareImageAutoRequest(c, &relaycommon.RelayInfo{
		OriginModelName: "image-auto",
		Request:         &dto.ImageRequest{Model: "image-auto", Prompt: "test"},
	})
	require.False(t, handled)
	require.ErrorIs(t, err, setting.ErrImageRoutingUnavailable)
}

func TestPrepareImageAutoRequestHonorsMaximumPointsCapBeforeUpstream(t *testing.T) {
	setImageRoutingOptionForControllerTest(t, `{
  "version":1,"revision":1,"enabled":true,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"enterprise","channel_id":108,"priority":1,"enabled":true,"billing_mode":"metered","upstream_model":"gpt-image-2","billing_model":"gpt-image-2","billing_group":"GPT企业旗舰","reserve_quota_by_quality":{"low":400000,"medium":800000,"high":2000000},"missing_usage_quota_by_quality":{"low":100000,"medium":400000,"high":1600000}}]
}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)
	c.Request.Header.Set(imageAutoMaxPointsHeader, "0.1")
	handled, err := prepareImageAutoRequest(c, &relaycommon.RelayInfo{
		OriginModelName: "image-auto",
		Request:         &dto.ImageRequest{Model: "image-auto", Prompt: "test"},
	})
	require.False(t, handled)
	require.ErrorContains(t, err, imageAutoMaxPointsHeader)
}

func TestImageAutoChannelMustRemainDedicatedToPublicGroupAndModel(t *testing.T) {
	mapping := `{"image-auto":"gpt-image-2"}`
	channel := &model.Channel{Group: "imageauto", Models: "image-auto", ModelMapping: &mapping}
	require.True(t, channelSupportsImageAutoRoute(channel, "imageauto", "image-auto", "gpt-image-2"))

	channel.Group = "imageauto,GPT企业旗舰"
	require.False(t, channelSupportsImageAutoRoute(channel, "imageauto", "image-auto", "gpt-image-2"))

	channel.Group = "imageauto"
	channel.Models = "image-auto,gpt-image-2"
	require.False(t, channelSupportsImageAutoRoute(channel, "imageauto", "image-auto", "gpt-image-2"))

	channel.Models = "image-auto"
	wrongMapping := `{"image-auto":"gpt-image-1"}`
	channel.ModelMapping = &wrongMapping
	require.False(t, channelSupportsImageAutoRoute(channel, "imageauto", "image-auto", "gpt-image-2"))

	invalidMapping := `{not-json}`
	channel.ModelMapping = &invalidMapping
	require.False(t, channelSupportsImageAutoRoute(channel, "imageauto", "image-auto", "gpt-image-2"))
}

func TestImageAutoMeteredPriceSnapshotMustFitConfiguredReserve(t *testing.T) {
	route := types.ImageRoutingRoute{
		ID:                    "enterprise",
		BillingMode:           types.ImageRoutingBillingMetered,
		ReserveQuotaByQuality: map[string]int{"low": 400000, "medium": 800000, "high": 2000000},
	}

	require.NoError(t, validateImageAutoMeteredReserveSnapshot(route, "high", 2, types.PriceData{
		QuotaToPreConsume: 4000000,
	}))
	require.NoError(t, validateImageAutoMeteredReserveSnapshot(route, "auto", 2, types.PriceData{
		QuotaToPreConsume: 4000000,
	}))
	require.ErrorContains(t, validateImageAutoMeteredReserveSnapshot(route, "high", 2, types.PriceData{
		QuotaToPreConsume: 4000001,
	}), "exceeds configured reserve")
	require.ErrorContains(t, validateImageAutoMeteredReserveSnapshot(route, "high", 2, types.PriceData{}), "positive pre-consume estimate")
}

func TestImageAutoRetriesSelectionFailureOnlyWhenAnotherRouteExists(t *testing.T) {
	plan, err := (types.ImageRoutingConfig{
		Enabled: true, PublicModel: "image-auto", PublicGroup: "imageauto", MaxN: 1,
		Routes: []types.ImageRoutingRoute{
			{ID: "alt", ChannelID: 36, Priority: 2, Enabled: true, BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 100000},
			{ID: "c", ChannelID: 15, Priority: 1, Enabled: true, BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 100000},
		},
	}).BuildPlan("low", 1)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{ImageRouting: relaycommon.NewImageRoutingState(plan)}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	err503 := types.NewErrorWithStatusCode(errors.New("unavailable"), types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable)
	require.True(t, shouldRetryImageAutoPreDispatchFailure(c, info, err503, 0))
	require.False(t, shouldRetryImageAutoPreDispatchFailure(c, info, err503, 1))
	err504 := types.NewErrorWithStatusCode(errors.New("timeout"), types.ErrorCodeGetChannelFailed, http.StatusGatewayTimeout)
	require.True(t, shouldRetryImageAutoPreDispatchFailure(c, info, err504, 0))
}

func TestImageAutoKeepaliveDoesNotBlockDefinitiveRouteRetry(t *testing.T) {
	plan, err := (types.ImageRoutingConfig{
		Enabled: true, PublicModel: "image-auto", PublicGroup: "imageauto", MaxN: 1,
		Routes: []types.ImageRoutingRoute{
			{ID: "alt", ChannelID: 36, Priority: 2, Enabled: true, BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 100000},
			{ID: "c", ChannelID: 15, Priority: 1, Enabled: true, BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 100000},
		},
	}).BuildPlan("low", 1)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{ImageRouting: relaycommon.NewImageRoutingState(plan)}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	require.NoError(t, helper.PingData(c))
	require.True(t, c.Writer.Written())

	rejected := types.ClassifyImageRoutingUpstreamResponse(types.NewOpenAIError(
		errors.New("rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	))
	require.True(t, isImageAutoRetryable(c, info, rejected, 0))

	info.ImageRouting.RecordDownstreamPayload(1)
	require.False(t, isImageAutoRetryable(c, info, rejected, 0))
}

func TestImageAutoChannelSelectionUsesLiveChannelState(t *testing.T) {
	plan, err := (types.ImageRoutingConfig{
		Enabled: true, PublicModel: "image-auto", PublicGroup: "imageauto", MaxN: 1,
		Routes: []types.ImageRoutingRoute{{
			ID: "alt", ChannelID: 36, Priority: 1, Enabled: true,
			BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 100000,
		}},
	}).BuildPlan("low", 1)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{OriginModelName: "image-auto", ImageRouting: relaycommon.NewImageRoutingState(plan)}

	originalLoader := imageAutoChannelLoader
	imageAutoChannelLoader = func(id int) (*model.Channel, error) {
		require.Equal(t, 36, id)
		mapping := `{"image-auto":"gpt-image-2"}`
		return &model.Channel{Id: id, Status: common.ChannelStatusAutoDisabled, Group: "imageauto", Models: "image-auto", ModelMapping: &mapping}, nil
	}
	t.Cleanup(func() { imageAutoChannelLoader = originalLoader })

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	channel, apiErr := getImageAutoChannel(c, info, 0)
	require.Nil(t, channel)
	require.NotNil(t, apiErr)
	require.ErrorContains(t, apiErr, "disabled")
}
