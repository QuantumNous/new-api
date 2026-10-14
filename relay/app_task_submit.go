package relay

import (
	"bytes"
	"errors"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func submitAppTask(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.TaskAdaptor, platform constant.TaskPlatform) (*TaskSubmitResult, *dto.TaskError) {
	identity, ok := adaptor.(interface {
		TaskPluginIdentity() (string, string, string)
	})
	if !ok {
		return nil, service.TaskErrorWrapperLocal(errors.New("model_not_supported"), "model_not_supported", http.StatusForbidden)
	}
	key, version, digest := identity.TaskPluginIdentity()
	if key != "doubao" || version != "1.2.0" || digest == "" || digest != info.AppSubject.PluginSHA256 {
		return nil, service.TaskErrorWrapperLocal(errors.New("model_not_supported"), "model_not_supported", http.StatusForbidden)
	}
	facts := map[string]any{}
	if provider, ok := adaptor.(channel.TaskValidatedUsageFactsProvider); ok {
		var err error
		facts, err = provider.ExtractUsageFactsValidated(c, info)
		if err != nil {
			return nil, service.TaskErrorWrapperLocal(errors.New("invalid_usage"), "invalid_usage", http.StatusBadRequest)
		}
	}
	body, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		return nil, service.TaskErrorWrapperLocal(errors.New("invalid_request"), "invalid_request", http.StatusBadRequest)
	}
	outbound, err := io.ReadAll(io.LimitReader(body, 64*1024+1))
	if err != nil || len(outbound) > 64*1024 {
		return nil, service.TaskErrorWrapperLocal(errors.New("invalid_request"), "invalid_request", http.StatusBadRequest)
	}
	inputs, err := service.CaptureAppTaskBillingInputs(c, info, facts)
	if err != nil {
		var authErr *service.AppPluginAuthError
		if errors.As(err, &authErr) {
			status := service.AppRelayErrorStatus(err)
			if authErr.Code == "invalid_price_inputs" {
				status = http.StatusBadRequest
			}
			return nil, service.TaskErrorWrapperLocal(
				errors.New(authErr.Code), authErr.Code, status,
			)
		}
		return nil, service.TaskErrorWrapperLocal(
			errors.New("service_unavailable"), "service_unavailable", http.StatusServiceUnavailable,
		)
	}
	if apiErr := service.PreConsumeBilling(c, 0, info); apiErr != nil {
		return nil, service.TaskErrorFromAPIError(apiErr)
	}
	session, ok := info.Billing.(*service.AppBillingSession)
	if !ok {
		return nil, service.TaskErrorWrapperLocal(errors.New("invalid_billing_session"), "invalid_billing_session", http.StatusInternalServerError)
	}
	execution, won, err := session.Claim(c, inputs, outbound)
	if err != nil {
		code := "service_unavailable"
		var authErr *service.AppPluginAuthError
		if errors.As(err, &authErr) {
			code = authErr.Code
		}
		return nil, service.TaskErrorWrapperLocal(errors.New(code), code, service.AppRelayErrorStatus(err))
	}
	info.PublicTaskID = execution.TaskID
	if !won {
		if !execution.ProviderAccepted {
			return nil, service.TaskErrorWrapperLocal(errors.New("submission_unknown"), "submission_unknown", http.StatusConflict)
		}
		return &TaskSubmitResult{Platform: platform, Quota: int(execution.ReservedQuota), AppExecution: &execution}, nil
	}
	// No legacy retry/refund is reachable after this committed dispatch claim.
	response, sendErr := adaptor.DoRequest(c, info, bytes.NewReader(outbound))
	if errors.Is(sendErr, channel.ErrProviderRequestNotStarted) {
		if err := session.ReleaseBeforeDispatch(c.Request.Context()); err != nil {
			return nil, service.TaskErrorWrapperLocal(errors.New("service_unavailable"), "service_unavailable", http.StatusServiceUnavailable)
		}
		return nil, service.TaskErrorWrapperLocal(errors.New("provider_request_not_started"), "provider_request_not_started", http.StatusBadGateway)
	}
	providerID := ""
	var responseBody []byte
	if response != nil {
		defer response.Body.Close()
		responseBody, err = io.ReadAll(io.LimitReader(response.Body, 64*1024+1))
		var accepted struct {
			ID string `json:"id"`
		}
		if sendErr == nil && err == nil && len(responseBody) <= 64*1024 &&
			response.StatusCode >= 200 && response.StatusCode < 300 &&
			common.Unmarshal(responseBody, &accepted) == nil && service.ValidAppProviderTaskID(accepted.ID) {
			providerID = accepted.ID
		}
	}
	if err := session.RecordAcceptance(c.Request.Context(), providerID); err != nil {
		return nil, service.TaskErrorWrapperLocal(errors.New("service_unavailable"), "service_unavailable", http.StatusServiceUnavailable)
	}
	if providerID == "" {
		return nil, service.TaskErrorWrapperLocal(errors.New("submission_unknown"), "submission_unknown", http.StatusBadGateway)
	}
	// Parsing can fail after acceptance. Host polling will recover the stored
	// provider ID; the accepted execution must still remain committed.
	response.Body = io.NopCloser(bytes.NewReader(responseBody))
	_, _ = adaptor.ParseResponse(c, response, info)
	execution.ProviderTaskID, execution.ProviderAccepted = providerID, true
	execution.Status, execution.ProviderState = "accepted", "queued"
	return &TaskSubmitResult{Platform: platform, Quota: int(execution.ReservedQuota), AppExecution: &execution}, nil
}

// AppTaskProjection returns stored facts for presentation; it performs no poll
// or settlement and does not expose provider credentials.
func AppTaskProjection(c *gin.Context, execution *model.AppTaskExecution) (*model.Task, error) {
	var task model.Task
	err := model.DB.WithContext(c.Request.Context()).Where("task_id = ? AND user_id = ? AND execution_mode = ?",
		execution.TaskID, execution.UserID, "app_managed").First(&task).Error
	return &task, err
}
