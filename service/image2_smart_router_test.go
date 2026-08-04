package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func image2TestChannel(id, priority int, operations, resolutions []string, editsAccepted bool) *model.Channel {
	setting := dto.ChannelSettings{Image2Capability: &dto.Image2ChannelCapability{
		Enabled: true, Operations: operations, Resolutions: resolutions, EditsAccepted: editsAccepted, RoutePriority: priority,
	}}
	channel := &model.Channel{Id: id}
	channel.SetSetting(setting)
	if channel.GetSetting().Image2Capability == nil {
		panic("image2 test channel lost capability setting")
	}
	return channel
}

func image2ProfileChannel(id int, name string, priority int, operations, resolutions, qualities []string, maxN uint, editsAccepted bool) *model.Channel {
	channel := image2TestChannel(id, priority, operations, resolutions, editsAccepted)
	channel.Name = name
	setting := channel.GetSetting()
	setting.Image2Capability.Qualities = qualities
	setting.Image2Capability.MaxN = maxN
	channel.SetSetting(setting)
	return channel
}

func TestImage2SmartRouterDisabledKeepsLegacyPath(t *testing.T) {
	old := common.Image2SmartRoutingEnabled
	common.Image2SmartRoutingEnabled = false
	t.Cleanup(func() { common.Image2SmartRoutingEnabled = old })
	c, _ := gin.CreateTestContext(nil)
	router, err := NewImage2SmartRouter(c, &relaycommon.RelayInfo{OriginModelName: "gpt-image-2", RelayMode: relayconstant.RelayModeImagesGenerations}, &dto.ImageRequest{})
	require.NoError(t, err)
	require.Nil(t, router)
}

func TestImage2SmartRouterSpecificChannelKeepsPinnedLegacyPath(t *testing.T) {
	old := common.Image2SmartRoutingEnabled
	common.Image2SmartRoutingEnabled = true
	t.Cleanup(func() { common.Image2SmartRoutingEnabled = old })

	c, _ := gin.CreateTestContext(nil)
	c.Set("specific_channel_id", "47")
	router, err := NewImage2SmartRouter(
		c,
		&relaycommon.RelayInfo{
			OriginModelName: "gpt-image-2",
			RelayMode:       relayconstant.RelayModeImagesGenerations,
		},
		&dto.ImageRequest{Size: "1024x1024"},
	)

	require.NoError(t, err)
	require.Nil(t, router, "a specifically selected channel must bypass smart routing")
}

func TestImage2SmartRouterResolutionAndEditFiltering(t *testing.T) {
	web := image2TestChannel(1, 10, []string{"generations"}, []string{"1024"}, false)
	codex := image2TestChannel(2, 20, []string{"generations", "edits"}, []string{"1024", "2048"}, true)
	adobe := image2TestChannel(3, 30, []string{"generations", "edits"}, []string{"1024", "2048", "uhd"}, false)

	for _, test := range []struct {
		name, resolution, operation string
		want                        []int
	}{
		{"1024 generation", "1024", "generations", []int{1, 2, 3}},
		{"2048 generation", "2048", "generations", []int{2, 3}},
		{"uhd generation", "uhd", "generations", []int{3}},
		{"edits excludes unaccepted", "1024", "edits", []int{2}},
	} {
		t.Run(test.name, func(t *testing.T) {
			router := newImage2SmartRouter(Image2RequestCapability{Resolution: test.resolution, Operation: test.operation, N: 1}, []*model.Channel{adobe, codex, web})
			got := make([]int, 0, len(test.want))
			for range test.want {
				channel, err := router.Next()
				require.Nil(t, err)
				got = append(got, channel.Id)
			}
			require.Equal(t, test.want, got)
			_, err := router.Next()
			require.True(t, types.IsSkipRetryError(err))
		})
	}
}

func TestImage2SmartRouterIncompatibleCandidatesAreNeverCalled(t *testing.T) {
	var incompatibleCalls int
	incompatible := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		incompatibleCalls++
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(incompatible.Close)

	compatibleCalls := 0
	compatible := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		compatibleCalls++
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(compatible.Close)

	router := newImage2SmartRouter(
		Image2RequestCapability{Operation: "edits", Resolution: "2048", Quality: "high", N: 2},
		[]*model.Channel{
			image2TestChannel(1, 10, []string{"generations"}, []string{"2048"}, false),
			image2TestChannel(2, 20, []string{"edits"}, []string{"2048"}, true),
		},
	)
	selected, routeErr := router.Next()
	require.Nil(t, routeErr)
	require.Equal(t, 2, selected.Id)

	upstreams := map[int]string{1: incompatible.URL, 2: compatible.URL}
	response, requestErr := http.Get(upstreams[selected.Id])
	require.NoError(t, requestErr)
	response.Body.Close()

	require.Equal(t, 0, incompatibleCalls)
	require.Equal(t, 1, compatibleCalls)
	require.Contains(t, router.DecisionSummary(), "1:operation_unsupported")
}

func TestImage2SmartRouterDeduplicatesChannelAttempts(t *testing.T) {
	first := image2TestChannel(1, 10, []string{"generations"}, []string{"1024"}, false)
	duplicate := image2TestChannel(1, 10, []string{"generations"}, []string{"1024"}, false)
	second := image2TestChannel(2, 20, []string{"generations"}, []string{"1024"}, false)
	router := newImage2SmartRouter(
		Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 1},
		[]*model.Channel{first, duplicate, second},
	)

	selectedIDs := make([]int, 0, 2)
	for range 2 {
		selected, routeErr := router.Next()
		require.Nil(t, routeErr)
		selectedIDs = append(selectedIDs, selected.Id)
	}
	require.Equal(t, []int{1, 2}, selectedIDs)
	_, routeErr := router.Next()
	require.True(t, types.IsSkipRetryError(routeErr))
}

// This simulates isolated fake upstreams: 503, 503, then 200. It exercises
// the same ordered candidate chain and safe replay decision used by Relay.
func TestImage2FakeUpstream503Then503Then200(t *testing.T) {
	router := newImage2SmartRouter(Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 1}, []*model.Channel{
		image2TestChannel(1, 10, []string{"generations"}, []string{"1024"}, false),
		image2TestChannel(2, 20, []string{"generations"}, []string{"1024"}, false),
		image2TestChannel(3, 30, []string{"generations"}, []string{"1024"}, false),
	})
	statuses := []int{http.StatusServiceUnavailable, http.StatusServiceUnavailable, http.StatusOK}
	servers := make([]*httptest.Server, 0, len(statuses))
	for _, status := range statuses {
		fakeStatus := status
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(fakeStatus) }))
		servers = append(servers, server)
		t.Cleanup(server.Close)
	}
	called := make([]int, 0, len(statuses))
	for index := range statuses {
		channel, err := router.Next()
		require.Nil(t, err)
		called = append(called, channel.Id)
		response, requestErr := http.Get(servers[index].URL)
		require.NoError(t, requestErr)
		status := response.StatusCode
		response.Body.Close()
		if status == http.StatusOK {
			break
		}
		decision := EvaluateImage2SafeFailover(SafeFailoverInput{RelayMode: relayconstant.RelayModeImagesGenerations, ModelName: "gpt-image-2", Error: types.NewOpenAIError(errors.New("fake upstream"), "", status)})
		require.True(t, decision.Retry)
	}
	require.Equal(t, []int{1, 2, 3}, called)
}

func TestParseImage2RequestCapability(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "gpt-image-2", RelayMode: relayconstant.RelayModeImagesEdits}
	capability, err := ParseImage2RequestCapability(info, &dto.ImageRequest{Size: "4096x4096"})
	require.NoError(t, err)
	require.Equal(t, "edits", capability.Operation)
	require.Equal(t, "uhd", capability.Resolution)
	capability, err = ParseImage2RequestCapability(info, &dto.ImageRequest{Size: "auto"})
	require.NoError(t, err)
	require.Equal(t, "1024", capability.Resolution)
}

func TestImage2SmartRouterExcludesChannelWithoutCapabilityMetadata(t *testing.T) {
	configured := image2TestChannel(1, 10, []string{"generations"}, []string{"1024"}, false)
	unconfigured := &model.Channel{Id: 2}
	router := newImage2SmartRouter(Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 1}, []*model.Channel{unconfigured, configured})

	channel, err := router.Next()
	require.Nil(t, err)
	require.Equal(t, configured.Id, channel.Id)
	require.Contains(t, router.DecisionSummary(), "2:image2_capability_not_enabled")
	_, err = router.Next()
	require.True(t, types.IsSkipRetryError(err))
}

func TestImage2SmartRouterDoesNotRepairMalformedSettingOnRequestPath(t *testing.T) {
	rawSetting := "{not-json"
	channel := &model.Channel{Id: 9, Setting: &rawSetting}

	router := newImage2SmartRouter(
		Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 1},
		[]*model.Channel{channel},
	)

	require.NotNil(t, channel.Setting)
	require.Equal(t, rawSetting, *channel.Setting)
	require.Contains(t, router.DecisionSummary(), "9:image2_capability_invalid")
	_, err := router.Next()
	require.True(t, types.IsSkipRetryError(err))
}

func TestImage2SmartRouterMalformedOnlyCapabilityDoesNotFallBackToLegacy(t *testing.T) {
	rawSetting := "{not-json"
	channel := &model.Channel{Id: 9, Setting: &rawSetting}

	router, configured := newImage2SmartRouterIfConfigured(
		Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 1},
		[]*model.Channel{channel},
	)

	require.True(t, configured, "a malformed opt-in setting must block legacy fallback")
	require.NotNil(t, router)
	require.Contains(t, router.DecisionSummary(), "9:image2_capability_invalid")
	_, err := router.Next()
	require.True(t, types.IsSkipRetryError(err), "an invalid sole capability must fail closed")
}

func TestImage2SmartRouterFallsBackOnlyWhenAllCapabilitiesAreMissing(t *testing.T) {
	unconfigured := []*model.Channel{nil, {Id: 1}, {Id: 2}}
	request := Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 1}
	router, capabilityConfigured := newImage2SmartRouterIfConfigured(request, unconfigured)
	require.False(t, capabilityConfigured)
	require.Nil(t, router, "a capability migration omission must preserve legacy routing")

	configuredButIncompatible := image2TestChannel(
		3,
		10,
		[]string{"generations"},
		[]string{"uhd"},
		false,
	)
	configuredChannels := append(unconfigured, configuredButIncompatible)
	router, capabilityConfigured = newImage2SmartRouterIfConfigured(request, configuredChannels)
	require.True(t, capabilityConfigured)
	require.NotNil(t, router, "configured but incompatible capabilities must remain fail-closed")
	_, routeErr := router.Next()
	require.True(t, types.IsSkipRetryError(routeErr))
	require.Contains(t, router.DecisionSummary(), "resolution_unsupported")
}

func TestImage2SmartRouterQualityFiltering(t *testing.T) {
	channel := image2TestChannel(1, 10, []string{"generations"}, []string{"1024"}, false)
	setting := channel.GetSetting()
	setting.Image2Capability.Qualities = []string{"standard", "high"}
	channel.SetSetting(setting)

	t.Run("omitted quality uses provider default", func(t *testing.T) {
		router := newImage2SmartRouter(Image2RequestCapability{
			Operation:  "generations",
			Resolution: "1024",
			N:          1,
		}, []*model.Channel{channel})

		selected, err := router.Next()
		require.Nil(t, err)
		require.Equal(t, channel.Id, selected.Id)
	})

	t.Run("explicit unsupported quality is rejected", func(t *testing.T) {
		router := newImage2SmartRouter(Image2RequestCapability{
			Operation:  "generations",
			Resolution: "1024",
			Quality:    "ultra",
			N:          1,
		}, []*model.Channel{channel})

		_, err := router.Next()
		require.True(t, types.IsSkipRetryError(err))
		require.Contains(t, router.DecisionSummary(), "1:quality_unsupported")
	})
}

func TestImage2SmartRouterQuantityFiltering(t *testing.T) {
	limited := image2TestChannel(1, 10, []string{"generations"}, []string{"1024"}, false)
	limitedSetting := limited.GetSetting()
	limitedSetting.Image2Capability.MaxN = 1
	limited.SetSetting(limitedSetting)

	compatible := image2TestChannel(2, 20, []string{"generations"}, []string{"1024"}, false)
	compatibleSetting := compatible.GetSetting()
	compatibleSetting.Image2Capability.MaxN = 4
	compatible.SetSetting(compatibleSetting)

	router := newImage2SmartRouter(
		Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 2},
		[]*model.Channel{limited, compatible},
	)
	selected, routeErr := router.Next()
	require.Nil(t, routeErr)
	require.Equal(t, compatible.Id, selected.Id)
	require.Contains(t, router.DecisionSummary(), "1:n_exceeds_limit")
}

func TestImage2WebCodexAdobeCapabilityCandidateChains(t *testing.T) {
	// These are capability profiles, not production channel IDs. They encode
	// the documented Web -> Codex -> Adobe fallback order while keeping the
	// actual channel identity in metadata rather than in routing code.
	web := image2ProfileChannel(101, "Web", 10,
		[]string{"generations"}, []string{"1024"}, []string{"standard"}, 1, false)
	codex := image2ProfileChannel(102, "Codex", 20,
		[]string{"generations", "edits"}, []string{"1024", "2048"}, []string{"standard", "high"}, 4, true)
	adobe := image2ProfileChannel(103, "Adobe", 30,
		[]string{"generations"}, []string{"1024", "2048", "uhd"}, []string{"standard", "high"}, 4, false)
	channels := []*model.Channel{adobe, web, codex}

	tests := []struct {
		name      string
		request   Image2RequestCapability
		wantNames []string
	}{
		{
			name:      "1024 standard generation uses all three in priority order",
			request:   Image2RequestCapability{Operation: "generations", Resolution: "1024", Quality: "standard", N: 1},
			wantNames: []string{"Web", "Codex", "Adobe"},
		},
		{
			name:      "quality high removes Web before any upstream call",
			request:   Image2RequestCapability{Operation: "generations", Resolution: "1024", Quality: "high", N: 1},
			wantNames: []string{"Codex", "Adobe"},
		},
		{
			name:      "2048 generation starts at Codex then Adobe",
			request:   Image2RequestCapability{Operation: "generations", Resolution: "2048", Quality: "high", N: 1},
			wantNames: []string{"Codex", "Adobe"},
		},
		{
			name:      "UHD generation is Adobe only",
			request:   Image2RequestCapability{Operation: "generations", Resolution: "uhd", Quality: "high", N: 1},
			wantNames: []string{"Adobe"},
		},
		{
			name:      "edit requires the accepted Codex profile",
			request:   Image2RequestCapability{Operation: "edits", Resolution: "1024", Quality: "high", N: 1},
			wantNames: []string{"Codex"},
		},
		{
			name:      "quantity two removes Web max_n one",
			request:   Image2RequestCapability{Operation: "generations", Resolution: "1024", Quality: "standard", N: 2},
			wantNames: []string{"Codex", "Adobe"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := newImage2SmartRouter(test.request, channels)
			gotNames := make([]string, 0, len(router.candidates))
			for range test.wantNames {
				channel, routeErr := router.Next()
				require.Nil(t, routeErr)
				gotNames = append(gotNames, channel.Name)
			}
			require.Equal(t, test.wantNames, gotNames)
			_, routeErr := router.Next()
			require.Error(t, routeErr)
			require.True(t, types.IsSkipRetryError(routeErr))
		})
	}
}

func TestImage2PriorityChainContinuesBeyondSingleFailover(t *testing.T) {
	router := newImage2SmartRouter(Image2RequestCapability{
		Operation: "generations", Resolution: "1024", Quality: "standard", N: 1,
	}, []*model.Channel{
		image2ProfileChannel(101, "Web", 10, []string{"generations"}, []string{"1024"}, []string{"standard"}, 1, false),
		image2ProfileChannel(102, "Codex", 20, []string{"generations"}, []string{"1024"}, []string{"standard"}, 1, false),
		image2ProfileChannel(103, "Adobe", 30, []string{"generations"}, []string{"1024"}, []string{"standard"}, 1, false),
	})
	statuses := []int{http.StatusServiceUnavailable, http.StatusServiceUnavailable, http.StatusOK}
	servers := make([]*httptest.Server, 0, len(statuses))
	for _, status := range statuses {
		fakeStatus := status
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(fakeStatus)
		}))
		servers = append(servers, server)
		t.Cleanup(server.Close)
	}

	called := make([]string, 0, len(statuses))
	for index, server := range servers {
		channel, routeErr := router.Next()
		require.Nil(t, routeErr)
		called = append(called, channel.Name)
		response, requestErr := http.Get(server.URL)
		require.NoError(t, requestErr)
		response.Body.Close()
		if response.StatusCode == http.StatusOK {
			break
		}
		decision := EvaluateImage2SafeFailover(SafeFailoverInput{
			RetryIndex:     index,
			MaxAttempts:    0, // explicit exhaustive mode: continue all priorities
			RelayMode:      relayconstant.RelayModeImagesGenerations,
			ModelName:      "gpt-image-2",
			AttemptElapsed: time.Second,
			ImageGuard:     60 * time.Second,
			Error:          types.NewErrorWithStatusCode(errors.New("temporary upstream failure"), types.ErrorCodeBadResponseStatusCode, response.StatusCode),
		})
		require.True(t, decision.Retry, "priority %d should continue to the next candidate: %s", index, decision.Reason)
	}
	require.Equal(t, []string{"Web", "Codex", "Adobe"}, called)
	_, routeErr := router.Next()
	require.Error(t, routeErr)
	require.True(t, types.IsSkipRetryError(routeErr))
}

func TestImage2SafeFailoverClassifiesReplayFailures(t *testing.T) {
	makeError := func(status int, code types.ErrorCode, message string) *types.NewAPIError {
		return types.NewErrorWithStatusCode(errors.New(message), code, status)
	}
	tests := []struct {
		name      string
		err       *types.NewAPIError
		wantClass image2FailureClass
		wantRetry bool
	}{
		{"400 deterministic", makeError(http.StatusBadRequest, types.ErrorCodeBadResponseStatusCode, "invalid size"), image2FailureDeterministic4xx, false},
		{"401 deterministic", makeError(http.StatusUnauthorized, types.ErrorCodeBadResponseStatusCode, "unauthorized"), image2FailureDeterministic4xx, false},
		{"403 deterministic", makeError(http.StatusForbidden, types.ErrorCodeBadResponseStatusCode, "forbidden"), image2FailureDeterministic4xx, false},
		{"404 deterministic", makeError(http.StatusNotFound, types.ErrorCodeBadResponseStatusCode, "not found"), image2FailureDeterministic4xx, false},
		{"408 deterministic", makeError(http.StatusRequestTimeout, types.ErrorCodeBadResponseStatusCode, "request timeout"), image2FailureDeterministic4xx, false},
		{"429 capacity", makeError(http.StatusTooManyRequests, types.ErrorCodeBadResponseStatusCode, "capacity"), image2FailureCapacity, true},
		{"503 server", makeError(http.StatusServiceUnavailable, types.ErrorCodeBadResponseStatusCode, "unavailable"), image2FailureServer5xx, true},
		{"transport", makeError(http.StatusInternalServerError, types.ErrorCodeDoRequestFailed, "connection reset"), image2FailureTransport, true},
		{"channel-local", makeError(http.StatusInternalServerError, types.ErrorCodeChannelNoAvailableKey, "no enabled key"), image2FailureChannelLocal, true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := SafeFailoverInput{
				RelayMode:      relayconstant.RelayModeImagesGenerations,
				ModelName:      "gpt-image-2",
				AttemptElapsed: time.Second,
				ImageGuard:     60 * time.Second,
				Error:          test.err,
			}
			require.Equal(t, test.wantClass, classifyImage2Failure(test.err))
			decision := EvaluateImage2SafeFailover(input)
			require.Equal(t, test.wantRetry, decision.Retry)
		})
	}
}

func TestImage2LateFiveXXGuardBlocksAtExactBoundary(t *testing.T) {
	decision := EvaluateImage2SafeFailover(SafeFailoverInput{
		RelayMode:      relayconstant.RelayModeImagesGenerations,
		ModelName:      "gpt-image-2",
		AttemptElapsed: 60 * time.Second,
		ImageGuard:     60 * time.Second,
		Error:          types.NewErrorWithStatusCode(errors.New("ambiguous generation failure"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway),
	})
	require.False(t, decision.Retry)
	require.Equal(t, "image2_replay_guard_elapsed", decision.Reason)
}

func TestImage2SafeFailoverAttemptBoundaries(t *testing.T) {
	makeInput := func(retryIndex, maxAttempts int) SafeFailoverInput {
		return SafeFailoverInput{
			RetryIndex:     retryIndex,
			MaxAttempts:    maxAttempts,
			RelayMode:      relayconstant.RelayModeImagesGenerations,
			ModelName:      "gpt-image-2",
			AttemptElapsed: time.Second,
			ImageGuard:     60 * time.Second,
			Error:          types.NewErrorWithStatusCode(errors.New("temporary failure"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable),
		}
	}

	for _, test := range []struct {
		name       string
		input      SafeFailoverInput
		wantRetry  bool
		wantReason string
	}{
		{"default one retry first attempt", makeInput(0, 1), true, "upstream_server_error"},
		{"default one retry boundary", makeInput(1, 1), false, "attempt_limit"},
		{"two retries second attempt", makeInput(1, 2), true, "upstream_server_error"},
		{"two retries boundary", makeInput(2, 2), false, "attempt_limit"},
		{"explicit zero exhaustive", makeInput(5, 0), true, "upstream_server_error"},
	} {
		t.Run(test.name, func(t *testing.T) {
			decision := EvaluateImage2SafeFailover(test.input)
			require.Equal(t, test.wantRetry, decision.Retry)
			require.Equal(t, test.wantReason, decision.Reason)
		})
	}
}

func TestImage2SafeFailoverStopsDeterministicErrors(t *testing.T) {
	for _, test := range []struct {
		name  string
		err   *types.NewAPIError
		retry bool
	}{
		{"429 can move to next fake upstream", types.NewOpenAIError(errors.New("capacity"), "", http.StatusTooManyRequests), true},
		{"503 can move to next fake upstream", types.NewOpenAIError(errors.New("unavailable"), "", http.StatusServiceUnavailable), true},
		{"400 does not move", types.NewOpenAIError(errors.New("bad request"), "", http.StatusBadRequest), false},
		{"401 does not move", types.NewOpenAIError(errors.New("unauthorized"), "", http.StatusUnauthorized), false},
		{"403 does not move", types.NewOpenAIError(errors.New("forbidden"), "", http.StatusForbidden), false},
		{"404 does not move", types.NewOpenAIError(errors.New("not found"), "", http.StatusNotFound), false},
		{"accepted task does not move", types.NewOpenAIError(errors.New("task_id=abc"), "", http.StatusServiceUnavailable), false},
	} {
		t.Run(test.name, func(t *testing.T) {
			decision := EvaluateImage2SafeFailover(SafeFailoverInput{RelayMode: relayconstant.RelayModeImagesGenerations, ModelName: "gpt-image-2", Error: test.err})
			require.Equal(t, test.retry, decision.Retry)
		})
	}
}

func TestImage2SafeFailoverStopsAfterUnsafeReplayStages(t *testing.T) {
	replayableError := types.NewOpenAIError(errors.New("upstream unavailable"), "", http.StatusServiceUnavailable)
	for _, test := range []struct {
		name  string
		input SafeFailoverInput
	}{
		{"response already written", SafeFailoverInput{ResponseWritten: true, Error: replayableError}},
		{"response already received", SafeFailoverInput{ReceivedResponseCount: 1, Error: replayableError}},
		{"client canceled", SafeFailoverInput{RequestContextErr: context.Canceled, Error: replayableError}},
		{"content safety", SafeFailoverInput{Error: types.NewOpenAIError(errors.New("content safety blocked"), "", http.StatusUnprocessableEntity)}},
		{"upstream accepted", SafeFailoverInput{Error: types.NewOpenAIError(errors.New("task_id=accepted"), "", http.StatusServiceUnavailable)}},
	} {
		t.Run(test.name, func(t *testing.T) {
			test.input.RelayMode = relayconstant.RelayModeImagesGenerations
			test.input.ModelName = "gpt-image-2"
			decision := EvaluateImage2SafeFailover(test.input)
			require.False(t, decision.Retry)
		})
	}
}

func TestImage2SafeFailoverLateReplayGuard(t *testing.T) {
	const imageGuard = 60

	makeError := func(status int, code types.ErrorCode, message string) *types.NewAPIError {
		return types.NewErrorWithStatusCode(errors.New(message), code, status)
	}
	input := func(err *types.NewAPIError, elapsed int) SafeFailoverInput {
		return SafeFailoverInput{
			RelayMode:      relayconstant.RelayModeImagesGenerations,
			ModelName:      "gpt-image-2",
			AttemptElapsed: time.Duration(elapsed) * time.Second,
			ImageGuard:     imageGuard * time.Second,
			Error:          err,
		}
	}

	tests := []struct {
		name       string
		input      SafeFailoverInput
		wantRetry  bool
		wantReason string
	}{
		{
			name:       "early 5xx remains replayable",
			input:      input(makeError(http.StatusServiceUnavailable, types.ErrorCodeBadResponseStatusCode, "temporary upstream failure"), 5),
			wantRetry:  true,
			wantReason: "upstream_server_error",
		},
		{
			name:       "early transport remains replayable",
			input:      input(makeError(http.StatusInternalServerError, types.ErrorCodeDoRequestFailed, "connection reset"), 5),
			wantRetry:  true,
			wantReason: "transport_failure",
		},
		{
			name:       "late ambiguous 5xx is blocked",
			input:      input(makeError(http.StatusBadGateway, types.ErrorCodeBadResponseStatusCode, "generation failed"), 61),
			wantReason: "image2_replay_guard_elapsed",
		},
		{
			name:       "late ambiguous transport is blocked",
			input:      input(makeError(http.StatusInternalServerError, types.ErrorCodeDoRequestFailed, "do request failed"), 61),
			wantReason: "image2_replay_guard_elapsed",
		},
		{
			name:       "late rejected request with no task can replay",
			input:      input(makeError(http.StatusBadGateway, types.ErrorCodeBadResponseStatusCode, "request rejected; task not created"), 61),
			wantRetry:  true,
			wantReason: "upstream_server_error",
		},
		{
			name:       "late transport before dispatch can replay",
			input:      input(makeError(http.StatusInternalServerError, types.ErrorCodeDoRequestFailed, "upstream unavailable before request"), 61),
			wantRetry:  true,
			wantReason: "transport_failure",
		},
		{
			name:       "acceptance evidence still blocks",
			input:      input(makeError(http.StatusServiceUnavailable, types.ErrorCodeBadResponseStatusCode, "task_id=abc queued"), 61),
			wantReason: "upstream_accepted",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			decision := EvaluateImage2SafeFailover(test.input)
			if decision.Retry != test.wantRetry {
				t.Fatalf("EvaluateImage2SafeFailover().Retry = %t, want %t (reason=%s)", decision.Retry, test.wantRetry, decision.Reason)
			}
			if decision.Reason != test.wantReason {
				t.Fatalf("EvaluateImage2SafeFailover().Reason = %q, want %q", decision.Reason, test.wantReason)
			}
		})
	}
}
