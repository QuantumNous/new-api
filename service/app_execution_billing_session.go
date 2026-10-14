package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/url"
	"reflect"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AppBillingSession reserves only inside the execution claim transaction.
// Legacy settling/refunding never owns these funds, including after disconnect.
type AppBillingSession struct {
	service   *AppExecutionService
	info      *relaycommon.RelayInfo
	execution model.AppTaskExecution
}

func (s *AppBillingSession) Settle(int) error         { return errors.New("app_task_requires_host_settlement") }
func (s *AppBillingSession) Refund(*gin.Context)      {}
func (s *AppBillingSession) NeedsRefund() bool        { return false }
func (s *AppBillingSession) GetPreConsumedQuota() int { return int(s.execution.ReservedQuota) }
func (s *AppBillingSession) Reserve(int) error        { return errors.New("app_task_requires_durable_claim") }

func (s *AppBillingSession) Claim(c *gin.Context, inputs AppTaskBillingInputs, outbound []byte) (model.AppTaskExecution, bool, error) {
	var execution model.AppTaskExecution
	won := false
	err := model.RunAppPluginTransaction(s.service.db.WithContext(c.Request.Context()), func(tx *gorm.DB) error {
		info := s.info
		subject := info.AppSubject
		value, exists := c.Get(jsplugin.ContextKeyProtocolRequest)
		protocol, valid := value.(jsplugin.ProtocolRequestContext)
		envelope, object := protocol.Body.(map[string]any)
		if !exists || !valid || !object || envelope["kind"] != "json" {
			return appAuthError("invalid_request")
		}
		requestHash, err := appPluginHash([]any{subject.Protocol, envelope["value"]})
		if err != nil || requestHash != subject.SubmissionHash {
			return appAuthError("invalid_request")
		}
		grant, user, err := s.service.appRelayAuthorityTx(tx, *subject)
		if err != nil {
			return err
		}
		var candidates []model.AppExecutionModel
		if common.UnmarshalJsonStr(grant.ModelsJSON, &candidates) != nil {
			return appAuthError("invalid_grant")
		}
		index := slices.IndexFunc(candidates, func(candidate model.AppExecutionModel) bool {
			return candidate.ExecutionKind == model.AppExecutionModelKindTaskBacked &&
				candidate.PublicModel == subject.PublicModel && candidate.Protocol == subject.Protocol &&
				candidate.ChannelID == subject.ChannelID && candidate.Group == subject.Group
		})
		if index < 0 || info.UserId != subject.UserID || info.ChannelId != subject.ChannelID {
			return appAuthError("scope_denied")
		}
		selected := candidates[index]
		if info.OriginModelName != selected.PublicModel || info.UpstreamModelName != selected.ActualModel ||
			subject.PluginSHA256 != selected.PluginSHA256 {
			return appAuthError("scope_denied")
		}
		assetInputs, err := appRelayAssetInputs(grant, selected.PublicModel, selected.Protocol)
		if err != nil || !reflect.DeepEqual(subject.AssetInputs, assetInputs) {
			return appAuthError("scope_denied")
		}
		if err := ValidateAppProviderAssetInputs(outbound, assetInputs, s.service.options.Now()); err != nil {
			return err
		}
		var body map[string]any
		if decodeAppExecutionJSON(outbound, &body) != nil || body["model"] != selected.ActualModel {
			return appAuthError("invalid_request")
		}
		delete(body, "content")
		original, ok := envelope["value"].(map[string]any)
		if !ok {
			return appAuthError("invalid_request")
		}
		options, paths, err := appTaskPassthroughOptions(grant, *subject, original)
		if err != nil {
			return err
		}
		metadata := map[string]any{}
		for field, option := range options {
			if actual, exists := body[field]; !exists || !reflect.DeepEqual(actual, option) {
				return appAuthError("scope_denied")
			}
			if strings.HasPrefix(paths[field], "/metadata/") {
				delete(body, field)
				metadata[field] = option
			}
		}
		if len(metadata) > 0 {
			body["metadata"] = metadata
		}
		if size, ok := original["size"].(string); ok {
			resolution, err := appTaskVideoResolution(size)
			if err != nil || body["resolution"] != resolution {
				return appAuthError("scope_denied")
			}
			delete(body, "resolution")
		}
		body["model"] = selected.PublicModel
		if selected.Protocol == "openai_responses" {
			body["background"] = true
			if input, exists := original["input"]; exists {
				body["input"] = input
			}
		} else if content, exists := original["content"]; exists {
			body["content"] = content
		}
		if err := validateAppTaskBody(grant, selected.Protocol, selected.PublicModel, body); err != nil {
			return err
		}
		channel, err := validateAppRelayChannelTx(tx, grant, user, selected, GetChannelConstraints(c).Filters)
		if err != nil {
			return err
		}
		baseURL := channel.GetBaseURL()
		if baseURL == "" {
			baseURL = constant.GetChannelBaseURL(channel.Type)
		}
		if baseURL != info.ChannelBaseUrl || info.ChannelSetting.Proxy != channel.GetSetting().Proxy {
			return appAuthError("channel_changed")
		}
		credential := channel.Key
		keyIndex := info.ChannelMultiKeyIndex
		if channel.ChannelInfo.IsMultiKey {
			keys := channel.GetKeys()
			if keyIndex < 0 || keyIndex >= len(keys) {
				return appAuthError("channel_changed")
			}
			if status, set := channel.ChannelInfo.MultiKeyStatusList[keyIndex]; set && status != common.ChannelStatusEnabled {
				return appAuthError("channel_changed")
			}
			credential = keys[keyIndex]
		}
		if credential == "" || credential != info.ApiKey {
			return appAuthError("channel_changed")
		}
		now := s.service.options.Now()
		quote, err := ComputeAppTaskPrice(selected, inputs, now.Unix())
		if err != nil || quote.Clamp != nil {
			return appAuthError("pricing_not_supported")
		}
		facts, err := common.Marshal(inputs)
		if err != nil {
			return err
		}
		connection, err := appTaskConnectionDigest(s.service.options.DerivationKey, channel)
		if err != nil {
			return err
		}
		execution, won, err = model.ClaimAppTaskExecutionTx(tx, grant.GrantID, model.AppTaskExecution{
			GrantID: grant.GrantID, AppKey: grant.AppKey, InstallationID: grant.InstallationID,
			AppSessionID: grant.AppSessionID, Subject: grant.Subject, UserID: grant.UserID,
			RunID: grant.RunID, ExecutionRequestID: grant.ExecutionRequestID, Operation: grant.Operation,
			SubmissionHash: subject.SubmissionHash, PublicModel: selected.PublicModel, ActualModel: selected.ActualModel,
			ActualGroup: selected.Group, ChannelID: selected.ChannelID, PluginKey: selected.PluginKey,
			PluginVersion: selected.PluginVersion, PluginSHA256: selected.PluginSHA256, Protocol: selected.Protocol,
			FundingSource: grant.FundingSource, ReservedQuota: int64(quote.Quota), RequestFactsJSON: string(facts),
			ConnectionDigest: connection, CredentialIndex: keyIndex,
			CredentialDigest: appTaskCredentialDigest(s.service.options.DerivationKey, credential),
		}, now)
		return err
	})
	s.execution = execution
	return execution, won, appTaskClaimError(err)
}

func appTaskClaimError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, model.ErrAppExecutionScopeDenied):
		return appAuthError("scope_denied")
	case errors.Is(err, model.ErrAppExecutionIdempotencyConflict):
		return appAuthError("idempotency_conflict")
	case errors.Is(err, model.ErrAppExecutionGrantExpired):
		return appAuthError("execution_grant_expired")
	case errors.Is(err, model.ErrAppExecutionInvalidFunding):
		return appAuthError("invalid_funding")
	case errors.Is(err, model.ErrAppExecutionInvalidGrant):
		return appAuthError("invalid_grant")
	case errors.Is(err, model.ErrAppExecutionIdentityInactive):
		return appAuthError("identity_inactive")
	case errors.Is(err, model.ErrAppExecutionAccountingUnavailable):
		return appAuthError("wallet_accounting_unavailable")
	case errors.Is(err, model.ErrAppExecutionInsufficientQuota):
		return appAuthError("insufficient_quota")
	case errors.Is(err, model.ErrAppExecutionFundingPeriodChanged):
		return appAuthError("funding_period_changed")
	default:
		return appExecutionBoundaryError(err)
	}
}

func (s *AppBillingSession) RecordAcceptance(ctx context.Context, providerID string) error {
	state := "unknown"
	if providerID != "" {
		state = "queued"
	}
	persistCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	return model.RunAppPluginTransaction(s.service.db.WithContext(persistCtx), func(tx *gorm.DB) error {
		return model.RecordAppTaskAcceptanceTx(tx, s.execution.ID, providerID, state, time.Now())
	})
}

func (s *AppBillingSession) ReleaseBeforeDispatch(ctx context.Context) error {
	persistCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	err := model.RunAppPluginTransaction(s.service.db.WithContext(persistCtx), func(tx *gorm.DB) error {
		return model.ReleaseAppTaskExecutionBeforeDispatchTx(tx, s.execution.ID)
	})
	if err == nil {
		s.execution = model.AppTaskExecution{}
	}
	return err
}

func appTaskCredentialDigest(key []byte, credential string) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte("new-api/app-task/credential/v1\x00"))
	mac.Write([]byte(credential))
	return hex.EncodeToString(mac.Sum(nil))
}

func appTaskConnectionDigest(key []byte, channel model.Channel) (string, error) {
	base := channel.GetBaseURL()
	if base == "" {
		base = constant.GetChannelBaseURL(channel.Type)
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("invalid_host_connection")
	}
	raw, err := common.Marshal([]any{channel.Type, base, channel.GetSetting()})
	if err != nil || len(key) < 32 {
		return "", errors.New("invalid_host_connection")
	}
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte("new-api/app-task/connection/v1\x00"))
	mac.Write(raw)
	return hex.EncodeToString(mac.Sum(nil)), nil
}
