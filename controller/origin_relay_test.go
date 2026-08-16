package controller

import (
	"context"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/origin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type originRelayControl struct {
	result   origin.AdmissionResult
	err      error
	requests []origin.AdmissionRequest
}

func (control *originRelayControl) CreateAdmission(_ context.Context, _ string, request origin.AdmissionRequest) (origin.AdmissionResult, error) {
	control.requests = append(control.requests, request)
	return control.result, control.err
}

func (control *originRelayControl) FetchCatalog(context.Context, string, string) (origin.CatalogFetchResult, error) {
	return origin.CatalogFetchResult{}, assert.AnError
}

func setupOriginRelayExecution(t *testing.T, control *originRelayControl, channelType int) (*gin.Context, *relaycommon.RelayInfo, *dto.OpenAIResponsesRequest) {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	baseURL := "https://beenex.invalid"
	modelMapping := `{"origin-codex":"wrong-model","wrong-model":"also-wrong"}`
	channel := model.Channel{
		Id:           7,
		Type:         channelType,
		Key:          "server-side-beenex-key",
		Status:       common.ChannelStatusEnabled,
		Name:         "BeeNex",
		BaseURL:      &baseURL,
		ModelMapping: &modelMapping,
	}
	require.NoError(t, db.Create(&channel).Error)

	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	var event origin.CatalogExecutionSnapshotPublishedV1
	require.NoError(t, common.Unmarshal(raw, &event))
	event.Payload.Routes[0].ApprovedChannelID = "7"
	event.Payload.ContentSHA256, err = origin.CanonicalSnapshotHash(event.Payload)
	require.NoError(t, err)
	raw, err = common.Marshal(event)
	require.NoError(t, err)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	view := origin.NewCatalogView(func() time.Time { return now })
	require.NoError(t, view.Install(raw, `"catalog-42"`))
	manager := origin.NewManager(control, view, func() time.Time { return now })
	restore := origin.ConfigureForTest(true, manager)
	t.Cleanup(restore)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Request = newJSONRequest(t, `{"model":"origin-codex","input":"hello","stream":true,"max_output_tokens":4096,"tools":[{"type":"function","name":"lookup"}],"reasoning":{"effort":"high"}}`)
	c.Set(common.RequestIdKey, "01980000-0000-7000-8000-000000000002")
	c.Set("original_model", "origin-codex")
	require.True(t, origin.SetCredential(c, "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd"))
	stream := true
	maxOutput := uint(4096)
	request := &dto.OpenAIResponsesRequest{
		Model:           "origin-codex",
		Input:           []byte(`"hello"`),
		Stream:          &stream,
		MaxOutputTokens: &maxOutput,
		Tools:           []byte(`[{"type":"function","name":"lookup"}]`),
		Reasoning:       &dto.Reasoning{Effort: "high"},
	}
	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIResponses, request, nil)
	require.NoError(t, err)
	return c, info, request
}

func newJSONRequest(t *testing.T, body string) *http.Request {
	t.Helper()
	request, err := http.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	require.NoError(t, err)
	request.Header.Set("Content-Type", "application/json")
	return request
}

func TestPrepareOriginExecutionPerformsAdmissionOnceAndLocksApprovedNewAPIChannel(t *testing.T) {
	requestID := "01980000-0000-7000-8000-000000000002"
	control := &originRelayControl{result: origin.AdmissionResult{
		RequestID:              requestID,
		TenantID:               "01980000-0000-7000-8000-000000000003",
		ProjectID:              "01980000-0000-7000-8000-000000000004",
		APIKeyID:               "01980000-0000-7000-8000-000000000005",
		ReservationID:          "01980000-0000-7000-8000-000000000006",
		ApprovedCatalogVersion: 42,
		RouteID:                "route_codex_responses_primary",
		ExpiresAt:              "2026-08-14T05:10:00Z",
	}}
	c, info, request := setupOriginRelayExecution(t, control, constant.ChannelTypeNewAPI)

	err := prepareOriginExecution(c, info, request, 1200)

	require.Nil(t, err)
	require.Len(t, control.requests, 1)
	assert.Equal(t, requestID, control.requests[0].RequestID)
	assert.Equal(t, int64(42), control.requests[0].CatalogVersion)
	assert.Equal(t, []string{"streaming", "function_tools", "reasoning"}, control.requests[0].RequestedCapabilities)
	execution, ok := origin.ExecutionFromContext(c)
	require.True(t, ok)
	assert.Equal(t, 7, execution.ChannelID)
	assert.Equal(t, "beenex-codex-1", execution.Grant.Route.UpstreamModelID)
	assert.Equal(t, constant.ChannelTypeNewAPI, common.GetContextKeyInt(c, constant.ContextKeyChannelType))
	assert.Empty(t, common.GetContextKeyString(c, constant.ContextKeyChannelModelMapping))
	_, hasCredential := origin.Credential(c)
	assert.False(t, hasCredential)
}

func TestPrepareOriginExecutionRejectsAdmissionBeforeSelectingBeeNex(t *testing.T) {
	control := &originRelayControl{err: &origin.ControlError{Status: 403, Code: "origin_key_project_mismatch"}}
	c, info, request := setupOriginRelayExecution(t, control, constant.ChannelTypeNewAPI)

	err := prepareOriginExecution(c, info, request, 1)

	require.NotNil(t, err)
	assert.Equal(t, 403, err.StatusCode)
	assert.Equal(t, types.ErrorCode("origin_key_project_mismatch"), err.GetErrorCode())
	_, ok := origin.ExecutionFromContext(c)
	assert.False(t, ok)
	assert.Zero(t, common.GetContextKeyInt(c, constant.ContextKeyChannelType))
}

func TestPrepareOriginExecutionRejectsNonNewAPIChannel(t *testing.T) {
	requestID := "01980000-0000-7000-8000-000000000002"
	control := &originRelayControl{result: origin.AdmissionResult{
		RequestID: requestID, TenantID: "01980000-0000-7000-8000-000000000003",
		ProjectID: "01980000-0000-7000-8000-000000000004", APIKeyID: "01980000-0000-7000-8000-000000000005",
		ReservationID: "01980000-0000-7000-8000-000000000006", ApprovedCatalogVersion: 42,
		RouteID: "route_codex_responses_primary", ExpiresAt: "2026-08-14T05:10:00Z",
	}}
	c, info, request := setupOriginRelayExecution(t, control, constant.ChannelTypeOpenAI)

	err := prepareOriginExecution(c, info, request, 1)

	require.NotNil(t, err)
	assert.Equal(t, types.ErrorCodeAccessDenied, err.GetErrorCode())
}

func TestPrepareOriginExecutionRejectsInsecureApprovedChannel(t *testing.T) {
	requestID := "01980000-0000-7000-8000-000000000002"
	control := &originRelayControl{result: origin.AdmissionResult{
		RequestID: requestID, TenantID: "01980000-0000-7000-8000-000000000003",
		ProjectID: "01980000-0000-7000-8000-000000000004", APIKeyID: "01980000-0000-7000-8000-000000000005",
		ReservationID: "01980000-0000-7000-8000-000000000006", ApprovedCatalogVersion: 42,
		RouteID: "route_codex_responses_primary", ExpiresAt: "2026-08-14T05:10:00Z",
	}}
	c, info, request := setupOriginRelayExecution(t, control, constant.ChannelTypeNewAPI)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 7).Update("base_url", "http://beenex.invalid").Error)

	err := prepareOriginExecution(c, info, request, 1)

	require.NotNil(t, err)
	assert.Equal(t, types.ErrorCodeAccessDenied, err.GetErrorCode())
	assert.Contains(t, err.Error(), "https")
	_, ok := origin.ExecutionFromContext(c)
	assert.False(t, ok)
}

func TestPrepareOriginExecutionRejectsDisabledTLSVerification(t *testing.T) {
	requestID := "01980000-0000-7000-8000-000000000002"
	control := &originRelayControl{result: origin.AdmissionResult{
		RequestID: requestID, TenantID: "01980000-0000-7000-8000-000000000003",
		ProjectID: "01980000-0000-7000-8000-000000000004", APIKeyID: "01980000-0000-7000-8000-000000000005",
		ReservationID: "01980000-0000-7000-8000-000000000006", ApprovedCatalogVersion: 42,
		RouteID: "route_codex_responses_primary", ExpiresAt: "2026-08-14T05:10:00Z",
	}}
	c, info, request := setupOriginRelayExecution(t, control, constant.ChannelTypeNewAPI)
	previousSkipVerify := common.TLSInsecureSkipVerify
	common.TLSInsecureSkipVerify = true
	t.Cleanup(func() { common.TLSInsecureSkipVerify = previousSkipVerify })

	err := prepareOriginExecution(c, info, request, 1)

	require.NotNil(t, err)
	assert.Equal(t, types.ErrorCodeAccessDenied, err.GetErrorCode())
	assert.Contains(t, err.Error(), "TLS verification")
	_, ok := origin.ExecutionFromContext(c)
	assert.False(t, ok)
}
