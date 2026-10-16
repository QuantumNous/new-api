package service

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// BatchBillingError is a batch billing rejection with the HTTP status and the
// stable code returned to the batch platform.
type BatchBillingError struct {
	Status  int
	Code    string
	Message *common.Message
}

func (e *BatchBillingError) Error() string {
	return e.Message.Error()
}

func newBatchBillingError(status int, code string, key string, params ...map[string]any) *BatchBillingError {
	return &BatchBillingError{Status: status, Code: code, Message: common.NewMessage(key, params...)}
}

// BatchBillingCharge is one charge reported by a batch inference platform.
// Usage prices the charge with the model's configured pricing and the batch
// group ratio; when Usage is nil, Quota is charged as given.
type BatchBillingCharge struct {
	RequestId  string
	Usage      *dto.Usage
	Quota      int
	Note       string
	OperatorId int
}

// BatchBillingResult reports a charge, or the earlier charge of a repeated
// request_id when Duplicate is set.
type BatchBillingResult struct {
	RequestId     string `json:"request_id"`
	UserId        int    `json:"user_id"`
	TokenId       int    `json:"token_id"`
	ModelName     string `json:"model_name"`
	Quota         int    `json:"quota"`
	BillingSource string `json:"billing_source"`
	Duplicate     bool   `json:"duplicate"`
	CreatedAt     int64  `json:"created_at"`
}

func batchBillingResultOf(record *model.BatchBillingRecord, duplicate bool) *BatchBillingResult {
	return &BatchBillingResult{
		RequestId:     record.RequestId,
		UserId:        record.UserId,
		TokenId:       record.TokenId,
		ModelName:     record.ModelName,
		Quota:         record.Quota,
		BillingSource: record.BillingSource,
		Duplicate:     duplicate,
		CreatedAt:     record.CreatedAt,
	}
}

// PrepareBatchBilling validates a batch group API key and returns a copy of c
// carrying the key owner's identity, together with the relay info used to
// price and charge the usage. The administrator's own context is left intact
// for the audit of the API call.
func PrepareBatchBilling(c *gin.Context, key string, modelName string) (*gin.Context, *relaycommon.RelayInfo, error) {
	key = strings.TrimPrefix(strings.TrimSpace(key), "sk-")
	token, err := model.ValidateUserToken(key)
	if err != nil {
		if errors.Is(err, model.ErrDatabase) {
			return nil, nil, err
		}
		if token == nil {
			return nil, nil, newBatchBillingError(http.StatusNotFound, "invalid_key", "API key does not exist")
		}
		return nil, nil, newBatchBillingError(http.StatusForbidden, "key_unavailable", "API key is disabled, expired, or exhausted")
	}
	if token.Group != constant.BatchGroup {
		return nil, nil, newBatchBillingError(http.StatusForbidden, "key_not_batch", "API key is not in the batch group")
	}
	if token.ModelLimitsEnabled && !token.GetModelLimitsMap()[modelName] {
		return nil, nil, newBatchBillingError(http.StatusForbidden, "model_not_allowed", "This API key cannot use model {{model}}", map[string]any{"model": modelName})
	}
	user, err := model.GetUserCache(token.UserId)
	if err != nil {
		return nil, nil, err
	}
	if user.Status != common.UserStatusEnabled {
		return nil, nil, newBatchBillingError(http.StatusForbidden, "user_disabled", "User is disabled")
	}
	if !CanUseBatchGroup(user.Group) {
		return nil, nil, newBatchBillingError(http.StatusForbidden, "batch_group_unavailable", "The batch group is not available for this user")
	}

	bc := c.Copy()
	user.WriteContext(bc)
	bc.Set(string(constant.ContextKeyUserId), token.UserId)
	bc.Set("token_id", token.Id)
	bc.Set("token_key", token.Key)
	bc.Set("token_name", token.Name)
	bc.Set("token_unlimited_quota", token.UnlimitedQuota)
	if !token.UnlimitedQuota {
		bc.Set("token_quota", token.RemainQuota)
	}
	common.SetContextKey(bc, constant.ContextKeyTokenGroup, token.Group)
	common.SetContextKey(bc, constant.ContextKeyUsingGroup, constant.BatchGroup)

	now := time.Now()
	info := &relaycommon.RelayInfo{
		TokenId:           token.Id,
		TokenKey:          token.Key,
		TokenGroup:        token.Group,
		UserId:            token.UserId,
		UsingGroup:        constant.BatchGroup,
		UserGroup:         user.Group,
		TokenUnlimited:    token.UnlimitedQuota,
		StartTime:         now,
		FirstResponseTime: now,
		OriginModelName:   modelName,
		UserSetting:       user.GetSetting(),
		UserEmail:         user.Email,
		UserQuota:         user.Quota,
		RelayFormat:       types.RelayFormatOpenAI,
		RequestId:         bc.GetString(common.RequestIdKey),
		// The full charge is reserved at once and rejected when funds are
		// insufficient, never admitted through the trusted-quota bypass.
		ForcePreConsume: true,
		// Billing expressions see no request body or headers: the platform
		// reports usage, not the original request.
		BillingRequestInput: &billingexpr.RequestInput{},
		ChannelMeta:         &relaycommon.ChannelMeta{},
	}
	return bc, info, nil
}

// ChargeBatchBilling charges a batch platform usage to the key owner with the
// same funding rules as a relay request: the billing preference chooses
// between subscription and wallet, the key's own quota is deducted, and an
// insufficient balance rejects the charge without moving funds. Each
// request_id is charged at most once. relayInfo must come from
// PrepareBatchBilling; for usage charges its PriceData must already be set.
func ChargeBatchBilling(c *gin.Context, relayInfo *relaycommon.RelayInfo, charge BatchBillingCharge) (*BatchBillingResult, error) {
	var settlement textSettlement
	quota := charge.Quota
	if charge.Usage != nil {
		settlement = calculateTextSettlement(c, relayInfo, charge.Usage)
		quota = settlement.summary.Quota
	}
	if relayInfo.QuotaClamp != nil {
		return nil, newBatchBillingError(http.StatusBadRequest, "quota_out_of_range", "The charge must be positive and within the supported quota range")
	}
	if quota < 0 {
		return nil, newBatchBillingError(http.StatusBadRequest, "quota_out_of_range", "The charge must be positive and within the supported quota range")
	}

	record := &model.BatchBillingRecord{
		RequestId:  charge.RequestId,
		UserId:     relayInfo.UserId,
		TokenId:    relayInfo.TokenId,
		ModelName:  relayInfo.OriginModelName,
		Quota:      quota,
		OperatorId: charge.OperatorId,
	}
	existing, claimed, err := model.ClaimBatchBillingRecord(record)
	if err != nil {
		return nil, err
	}
	if !claimed {
		if existing.Status != model.BatchBillingStatusSucceeded {
			return nil, newBatchBillingError(http.StatusConflict, "request_in_progress", "A charge with this request_id is still in progress")
		}
		if existing.TokenId != relayInfo.TokenId || existing.ModelName != relayInfo.OriginModelName {
			return nil, newBatchBillingError(http.StatusConflict, "request_id_conflict", "This request_id was already used for a different charge")
		}
		return batchBillingResultOf(existing, true), nil
	}

	if quota > 0 {
		session, apiErr := NewBillingSession(c, relayInfo, quota)
		if apiErr != nil {
			if releaseErr := model.ReleaseBatchBillingRecord(record.Id); releaseErr != nil {
				logger.LogError(c, common.LogText("failed to release batch billing record %s: %s", record.RequestId, releaseErr.Error()))
			}
			switch apiErr.GetErrorCode() {
			case types.ErrorCodeInsufficientUserQuota:
				return nil, newBatchBillingError(http.StatusPaymentRequired, "insufficient_quota", "Insufficient user quota")
			case types.ErrorCodePreConsumeTokenQuotaFailed:
				return nil, newBatchBillingError(http.StatusPaymentRequired, "insufficient_key_quota", "Insufficient API key quota")
			default:
				return nil, apiErr
			}
		}
		relayInfo.Billing = session
		// The reservation equals the charge, so settlement moves no further
		// funds; it commits the session and sends the low-balance notices.
		if err := SettleBilling(c, relayInfo, quota); err != nil {
			logger.LogError(c, common.LogText("error settling batch billing %s: %s", record.RequestId, err.Error()))
		}
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
	}
	record.BillingSource = relayInfo.BillingSource
	if record.BillingSource == "" {
		record.BillingSource = BillingSourceWallet
	}

	recordBatchBillingLog(c, relayInfo, charge, settlement, quota)

	if err := model.CompleteBatchBillingRecord(record); err != nil {
		// The funds already moved; the pending record keeps the request_id
		// from being charged again.
		logger.LogError(c, common.LogText("failed to complete batch billing record %s: %s", record.RequestId, err.Error()))
	}
	return batchBillingResultOf(record, false), nil
}

func recordBatchBillingLog(c *gin.Context, relayInfo *relaycommon.RelayInfo, charge BatchBillingCharge, settlement textSettlement, quota int) {
	summary := settlement.summary
	other := model.NewLogOther()
	if charge.Usage != nil {
		other.SetPublic("batch_billing_mode", "usage")
		other.SetPublic("model_ratio", summary.ModelRatio)
		other.SetPublic("group_ratio", summary.GroupRatio)
		other.SetPublic("completion_ratio", summary.CompletionRatio)
		other.SetPublic("cache_tokens", summary.CacheTokens)
		other.SetPublic("cache_ratio", summary.CacheRatio)
		other.SetPublic("model_price", summary.ModelPrice)
		other.SetPublic("user_group_ratio", relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio)
		if summary.CacheCreationTokens > 0 {
			other.SetPublic("cache_creation_tokens", summary.CacheCreationTokens)
			other.SetPublic("cache_creation_ratio", summary.CacheCreationRatio)
			other.SetPublic("cache_write_tokens", summary.CacheCreationTokens)
		}
		if settlement.tieredBillingApplied {
			InjectTieredBillingInfo(other, relayInfo, settlement.tieredResult)
		}
		if billingModel := relayInfo.GetBillingModelName(); billingModel != relayInfo.OriginModelName {
			other.SetAdmin("billing_model", billingModel)
		}
	} else {
		other.SetPublic("batch_billing_mode", "quota")
	}
	other.SetPublic("batch_billing", true)
	other.SetPublic("batch_request_id", charge.RequestId)
	other.SetAdmin("batch_billing_operator_id", charge.OperatorId)
	appendRequestPath(c, relayInfo, other)
	appendBillingInfo(relayInfo, other)
	attachQuotaSaturation(c, relayInfo, other)

	content := []*common.Message{common.NewMessage("Batch inference billing")}
	if charge.Note != "" {
		content = append(content, common.NewMessage("Batch platform note: {{note}}", map[string]any{"note": charge.Note}))
	}
	model.RecordConsumeLog(c, relayInfo.UserId, model.RecordConsumeLogParams{
		PromptTokens:     summary.PromptTokens,
		CompletionTokens: summary.CompletionTokens,
		ModelName:        relayInfo.OriginModelName,
		TokenName:        c.GetString("token_name"),
		Quota:            quota,
		Content:          content,
		TokenId:          relayInfo.TokenId,
		Group:            constant.BatchGroup,
		Other:            other,
	})
}
