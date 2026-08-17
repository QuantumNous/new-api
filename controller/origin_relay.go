package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/origin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func prepareOriginExecution(c *gin.Context, info *relaycommon.RelayInfo, request dto.Request, inputTokens int) *types.NewAPIError {
	credential, ok := origin.Credential(c)
	if !ok || info == nil || request == nil {
		return types.NewErrorWithStatusCode(errors.New("Origin request context is incomplete"), types.ErrorCodeAccessDenied, http.StatusUnauthorized, types.ErrOptionWithSkipRetry())
	}
	defer origin.ClearCredential(c)
	manager := origin.ActiveManager()
	if manager == nil {
		return types.NewErrorWithStatusCode(errors.New("Origin Platform is unavailable"), types.ErrorCode("platform_unavailable"), http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
	}
	operation := ""
	maxOutputTokens := 0
	capabilities := origin.RequestedCapabilities{Streaming: info.IsStream}
	switch value := request.(type) {
	case *dto.OpenAIResponsesRequest:
		operation = "responses"
		if value.MaxOutputTokens != nil {
			maxOutputTokens = int(*value.MaxOutputTokens)
		}
		capabilities.FunctionTools = len(value.Tools) > 0
		capabilities.Reasoning = value.Reasoning != nil
	case *dto.ClaudeRequest:
		operation = "messages"
		if value.MaxTokens != nil {
			maxOutputTokens = int(*value.MaxTokens)
		}
		capabilities.FunctionTools = len(value.GetTools()) > 0
		capabilities.Reasoning = value.Thinking != nil
	default:
		return types.NewErrorWithStatusCode(errors.New("Origin integration does not support this protocol"), types.ErrorCodeAccessDenied, http.StatusForbidden, types.ErrOptionWithSkipRetry())
	}
	grant, err := manager.Admit(c.Request.Context(), credential, origin.AdmissionInput{
		RequestID:          info.RequestId,
		PlatformModel:      info.OriginModelName,
		Operation:          operation,
		InputTokenEstimate: inputTokens,
		MaxOutputTokens:    maxOutputTokens,
		Capabilities:       capabilities,
	})
	if err != nil {
		return originRelayError(err)
	}
	channelID, err := origin.ResolveChannelID(grant.Route.ApprovedChannelID)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeAccessDenied, http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil {
		return types.NewErrorWithStatusCode(errors.New("approved Origin channel is unavailable"), types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
	}
	if validationErr := validateOriginApprovedChannel(channel); validationErr != nil {
		return validationErr
	}
	if setupErr := middleware.SetupContextForSelectedChannel(c, channel, info.OriginModelName); setupErr != nil {
		return setupErr
	}
	common.SetContextKey(c, constant.ContextKeyChannelModelMapping, "")
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})
	info.DisablePing = true
	info.FinalRequestRelayFormat = info.RelayFormat
	origin.SetExecution(c, origin.Execution{Grant: grant, ChannelID: channelID})
	return nil
}

func validateOriginApprovedChannel(channel *model.Channel) *types.NewAPIError {
	if channel == nil || channel.Status != common.ChannelStatusEnabled || channel.Type != constant.ChannelTypeNewAPI {
		return types.NewErrorWithStatusCode(errors.New("approved Origin channel is not an enabled New API channel"), types.ErrorCodeAccessDenied, http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
	}
	if common.TLSInsecureSkipVerify {
		return types.NewErrorWithStatusCode(errors.New("approved Origin channel requires TLS verification"), types.ErrorCodeAccessDenied, http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
	}
	baseURL := strings.TrimSpace(channel.GetBaseURL())
	parsedBaseURL, err := url.Parse(baseURL)
	if err != nil || !strings.EqualFold(parsedBaseURL.Scheme, "https") || parsedBaseURL.Host == "" || parsedBaseURL.User != nil {
		return types.NewErrorWithStatusCode(errors.New("approved Origin channel must use an absolute https URL without userinfo"), types.ErrorCodeAccessDenied, http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
	}
	if channel.Key == "" {
		return types.NewErrorWithStatusCode(errors.New("approved Origin channel is incomplete"), types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
	}
	return nil
}

func originRelayError(err error) *types.NewAPIError {
	var controlError *origin.ControlError
	if errors.As(err, &controlError) {
		status := controlError.Status
		if status < 400 || status > 599 {
			status = http.StatusServiceUnavailable
		}
		return types.NewErrorWithStatusCode(
			fmt.Errorf("Origin admission rejected: %s", controlError.Code),
			types.ErrorCode(controlError.Code),
			status,
			types.ErrOptionWithSkipRetry(),
		)
	}
	status := http.StatusServiceUnavailable
	code := types.ErrorCode("platform_unavailable")
	if errors.Is(err, origin.ErrCatalogModelUnknown) {
		status = http.StatusNotFound
		code = types.ErrorCode("model_not_available")
	} else if errors.Is(err, origin.ErrCatalogCapabilityDenied) {
		status = http.StatusForbidden
		code = types.ErrorCode("model_access_denied")
	}
	return types.NewErrorWithStatusCode(errors.New("Origin admission failed closed"), code, status, types.ErrOptionWithSkipRetry())
}

func createOriginAttempt(c *gin.Context, info *relaycommon.RelayInfo, attemptNumber int) (*model.OriginRequestAttempt, error) {
	execution, ok := origin.ExecutionFromContext(c)
	if !ok || info == nil {
		return nil, errors.New("Origin execution is missing")
	}
	startedAt := time.Now().UTC()
	leaseOwner, leaseUntil := origin.RequestAttemptLease(startedAt)
	attempt := &model.OriginRequestAttempt{
		ID:              uuid.NewString(),
		RequestID:       execution.Grant.Admission.RequestID,
		ReservationID:   execution.Grant.Admission.ReservationID,
		TenantID:        execution.Grant.Admission.TenantID,
		ProjectID:       execution.Grant.Admission.ProjectID,
		APIKeyID:        execution.Grant.Admission.APIKeyID,
		CatalogVersion:  execution.Grant.Admission.ApprovedCatalogVersion,
		RouteID:         execution.Grant.Route.RouteID,
		PlatformModel:   execution.Grant.Route.PlatformModel,
		Operation:       execution.Grant.Route.Operation,
		UpstreamModelID: execution.Grant.Route.UpstreamModelID,
		ChannelID:       execution.ChannelID,
		AttemptNumber:   attemptNumber,
		Stream:          info.IsStream,
		Status:          model.OriginAttemptInProgress,
		ContactState:    model.OriginContactNotContacted,
		LeaseOwner:      leaseOwner,
		LeaseUntil:      leaseUntil,
		StartedAt:       startedAt,
	}
	if err := model.CreateOriginRequestAttempt(model.DB, attempt); err != nil {
		return nil, err
	}
	origin.BeginAttempt(c, *attempt)
	return attempt, nil
}

func finalizeOriginAttempt(c *gin.Context, info *relaycommon.RelayInfo, relayErr *types.NewAPIError) error {
	attempt, outcome, ok := origin.AttemptTelemetrySnapshot(c)
	if !ok {
		return errors.New("Origin attempt telemetry is missing")
	}
	completedAt := time.Now().UTC()
	if originClientDisconnected(c) || info.IsStream && info.StreamStatus != nil && info.StreamStatus.EndReason == relaycommon.StreamEndReasonClientGone {
		outcome.TerminalStatus = "CLIENT_DISCONNECTED"
		if outcome.Usage == nil {
			outcome.ErrorCategory = "client_disconnected_before_usage"
		}
	} else if relayErr != nil {
		outcome.TerminalStatus = "UPSTREAM_ERROR"
		outcome.ErrorCategory = "upstream_error"
		if outcome.ContactState == model.OriginContactNotContacted {
			outcome.TerminalStatus = "GATEWAY_REJECTED"
			outcome.ErrorCategory = "before_upstream_failure"
		} else if relayErr.StatusCode == http.StatusRequestTimeout || relayErr.StatusCode == http.StatusGatewayTimeout ||
			info.StreamStatus != nil && info.StreamStatus.EndReason == relaycommon.StreamEndReasonTimeout {
			outcome.TerminalStatus = "UPSTREAM_TIMEOUT"
			outcome.ErrorCategory = "upstream_timeout"
		}
	} else {
		if outcome.TerminalStatus == "" {
			outcome.TerminalStatus = "SUCCESS"
		}
		if outcome.Usage == nil && outcome.ErrorCategory == "" {
			outcome.ErrorCategory = "usage_missing"
		}
	}
	eventID := uuid.NewString()
	event, err := origin.BuildUsageEvent(eventID, int64(attempt.AttemptNumber), attempt, outcome, completedAt, time.Now().UTC(), info.IsStream)
	if err != nil {
		return err
	}
	payload, err := common.Marshal(event)
	if err != nil {
		return err
	}
	attemptStatus := model.OriginAttemptSucceeded
	if event.ReservationAction == "RECONCILE" {
		attemptStatus = model.OriginAttemptReconciliation
	} else if outcome.TerminalStatus == "CLIENT_DISCONNECTED" {
		attemptStatus = model.OriginAttemptDisconnected
	} else if relayErr != nil || outcome.TerminalStatus != "SUCCESS" {
		attemptStatus = model.OriginAttemptFailed
	}
	outbox := &model.OriginUsageOutbox{
		ID:            eventID,
		AttemptID:     attempt.ID,
		RequestID:     attempt.RequestID,
		ReservationID: attempt.ReservationID,
		Topic:         origin.UsageTopic,
		PartitionKey:  event.PartitionKey,
		Payload:       string(payload),
		Status:        model.OriginOutboxPending,
	}
	return model.FinalizeOriginRequestAttempt(model.DB, attempt.ID, attemptStatus, outcome.ContactState, completedAt, outbox)
}

func originClientDisconnected(c *gin.Context) bool {
	return c != nil && c.Request != nil && errors.Is(c.Request.Context().Err(), context.Canceled)
}
