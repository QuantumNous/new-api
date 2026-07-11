package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	billingHoldReconcileDelaySec = 1200 // 与 image reconcile 一致：20 分钟后对账
	billingHoldScanIntervalSec   = 60
)

var billingHoldReconcileClaim sync.Map // holdId -> struct{}

// RecordBillingHoldAndSchedule 在 HoldRefund 时持久化挂账并预约对账。
func RecordBillingHoldAndSchedule(c *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) (*model.BillingHold, error) {
	if relayInfo == nil || relayInfo.Billing == nil || apiErr == nil {
		return nil, fmt.Errorf("missing relay billing context")
	}
	preConsumed := relayInfo.Billing.GetPreConsumedQuota()
	if preConsumed <= 0 {
		return nil, nil
	}

	requestId := strings.TrimSpace(relayInfo.RequestId)
	if requestId == "" && c != nil {
		requestId = c.GetString(common.RequestIdKey)
	}
	if requestId == "" {
		return nil, fmt.Errorf("missing request id for billing hold")
	}

	channelId := 0
	if relayInfo.ChannelMeta != nil {
		channelId = relayInfo.ChannelMeta.ChannelId
	}
	upstreamTaskID := ""
	if relayInfo.TaskRelayInfo != nil {
		upstreamTaskID = strings.TrimSpace(relayInfo.TaskRelayInfo.OriginTaskID)
	}

	tokenName := ""
	if c != nil {
		tokenName = c.GetString("token_name")
	}

	now := common.GetTimestamp()
	hold := &model.BillingHold{
		RequestId:         requestId,
		UserId:            relayInfo.UserId,
		TokenId:           relayInfo.TokenId,
		TokenName:         tokenName,
		ChannelId:         channelId,
		ModelName:         relayInfo.OriginModelName,
		Group:             relayInfo.UsingGroup,
		PreConsumedQuota:  preConsumed,
		ReceivedResponses: relayInfo.ReceivedResponseCount,
		UpstreamTaskId:    upstreamTaskID,
		ErrorStatus:       apiErr.StatusCode,
		ErrorCode:         string(apiErr.GetErrorCode()),
		ErrorMessage:      apiErr.Error(),
		Status:            model.BillingHoldStatusPending,
		CreatedAt:         now,
		ReconcileAfter:    now + billingHoldReconcileDelaySec,
	}
	if err := model.CreateBillingHold(hold); err != nil {
		return nil, err
	}
	scheduleBillingHoldReconcile(hold.Id)
	return hold, nil
}

func scheduleBillingHoldReconcile(holdId int) {
	if holdId <= 0 {
		return
	}
	gopool.Go(func() {
		hold, err := model.GetBillingHoldById(holdId)
		if err != nil {
			return
		}
		delay := time.Duration(hold.ReconcileAfter-common.GetTimestamp()) * time.Second
		if delay > 0 {
			time.Sleep(delay)
		}
		runBillingHoldReconcile(holdId)
	})
}

// StartBillingHoldReconcileTask 扫描到期挂账，防止 goroutine 丢失。
func StartBillingHoldReconcileTask() {
	gopool.Go(func() {
		ticker := time.NewTicker(time.Duration(billingHoldScanIntervalSec) * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			holds, err := model.ListDueBillingHolds(common.GetTimestamp(), 200)
			if err != nil {
				common.SysLog("billing hold scan failed: " + err.Error())
				continue
			}
			for _, hold := range holds {
				runBillingHoldReconcile(hold.Id)
			}
		}
	})
}

func runBillingHoldReconcile(holdId int) {
	if _, loaded := billingHoldReconcileClaim.LoadOrStore(holdId, struct{}{}); loaded {
		return
	}
	defer billingHoldReconcileClaim.Delete(holdId)

	claimed, err := model.ClaimBillingHold(holdId)
	if err != nil || !claimed {
		return
	}

	hold, err := model.GetBillingHoldById(holdId)
	if err != nil {
		_ = model.ResetBillingHoldProcessing(holdId)
		return
	}
	hold = enrichBillingHoldForVerify(hold)

	shouldRefund, detail := VerifyBillingHoldUpstreamCharge(hold)
	var resolveErr error
	if shouldRefund {
		resolveErr = RefundBillingHold(hold, detail)
	} else {
		resolveErr = ConfirmBillingHold(hold, detail)
	}
	if resolveErr != nil {
		common.SysLog(fmt.Sprintf("billing hold reconcile failed id=%d request=%s: %s", hold.Id, hold.RequestId, resolveErr.Error()))
		_ = model.ResetBillingHoldProcessing(holdId)
	}
}

// VerifyBillingHoldUpstreamCharge 核实上游是否扣款。
// 返回 shouldRefund=true 表示确认上游未扣款；false 表示应确认扣款（含无法核实）。
func VerifyBillingHoldUpstreamCharge(hold *model.BillingHold) (shouldRefund bool, detail string) {
	if hold == nil {
		return false, "missing hold"
	}

	if hold.UpstreamTaskId != "" && hold.ChannelId > 0 {
		uncharged, poll := upstreamImageTaskConfirmedUnchargedByChannel(hold.ChannelId, hold.UpstreamTaskId)
		if uncharged {
			return true, fmt.Sprintf("upstream image task terminal with zero cost (status=%s)", poll.Status)
		}
		if poll.Status != "" {
			if poll.UpstreamCost > 0 || poll.CreditsCost > 0 {
				return false, fmt.Sprintf("upstream image task charged cost=%.4f credits=%.4f", poll.UpstreamCost, poll.CreditsCost)
			}
			if imageTaskTerminalFailure(poll.Status) {
				return true, fmt.Sprintf("upstream image task terminal with zero cost (status=%s)", poll.Status)
			}
			return false, fmt.Sprintf("upstream image task still non-terminal status=%s", poll.Status)
		}
	}

	if hold.ReceivedResponses > 0 {
		return false, fmt.Sprintf("received %d upstream chunks before failure", hold.ReceivedResponses)
	}

	if apiErr := billingHoldAPIError(hold); apiErr != nil {
		if ClassifyUpstreamChargeConfidence(apiErr) == UpstreamChargeConfirmedNot {
			return true, "relay error confirms upstream not charged: " + apiErr.Error()
		}
	}

	if charged, msg, ok := queryUpstreamConsumeEvidence(hold); ok {
		if charged {
			return false, msg
		}
		return true, msg
	}

	return false, "upstream charge unverified; confirm preconsume per policy"
}

func enrichBillingHoldForVerify(hold *model.BillingHold) *model.BillingHold {
	if hold == nil {
		return hold
	}
	if hold.UpstreamTaskId != "" && hold.ChannelId > 0 {
		return hold
	}
	ctx, ok := model.FindErrorLogContextForRequestId(hold.UserId, hold.RequestId)
	if !ok {
		return hold
	}
	patch := model.BillingHoldContextPatch{}
	if hold.ChannelId <= 0 && ctx.ChannelId > 0 {
		patch.ChannelId = ctx.ChannelId
	}
	if hold.UpstreamTaskId == "" && ctx.TaskID != "" {
		patch.UpstreamTaskId = ctx.TaskID
	}
	if hold.ErrorCode == "" && ctx.ErrorCode != "" {
		patch.ErrorCode = ctx.ErrorCode
	}
	if patch.ChannelId == 0 && patch.UpstreamTaskId == "" && patch.ErrorCode == "" {
		return hold
	}
	_ = model.UpdateBillingHoldContext(hold.Id, patch)
	updated, err := model.GetBillingHoldById(hold.Id)
	if err != nil {
		return hold
	}
	return updated
}

func billingHoldAPIError(hold *model.BillingHold) *types.NewAPIError {
	if hold == nil {
		return nil
	}
	err := fmt.Errorf("%s", hold.ErrorMessage)
	if hold.ErrorCode != "" {
		return types.NewErrorWithStatusCode(err, types.ErrorCode(hold.ErrorCode), hold.ErrorStatus)
	}
	return types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponseStatusCode, hold.ErrorStatus)
}

func upstreamImageTaskConfirmedUnchargedByChannel(channelId int, upstreamTaskID string) (bool, ImageTaskPollResult) {
	channel, err := model.GetChannelById(channelId, true)
	if err != nil || channel == nil {
		return false, ImageTaskPollResult{}
	}
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return false, ImageTaskPollResult{}
	}
	poll, err := fetchImageTaskStatusOnce(channel.GetBaseURL(), key, upstreamTaskID)
	if err != nil {
		return false, poll
	}
	if !imageTaskTerminalFailure(poll.Status) {
		return false, poll
	}
	if poll.UpstreamCost > 0 || poll.CreditsCost > 0 {
		return false, poll
	}
	return true, poll
}

func queryUpstreamConsumeEvidence(hold *model.BillingHold) (charged bool, detail string, ok bool) {
	if hold == nil || hold.ChannelId <= 0 {
		return false, "", false
	}
	channel, err := model.GetChannelById(hold.ChannelId, true)
	if err != nil || channel == nil {
		return false, "channel unavailable", false
	}
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return false, "channel key unavailable", false
	}

	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	// new-api / one-api relay: 尝试按 request_id 查消费日志（需上游保留相同 request_id 或管理员权限）
	url := fmt.Sprintf("%s/api/log/?request_id=%s&type=2&p=1&page_size=1", baseURL, hold.RequestId)
	body, err := fetchURLWithBearer(url, key, channel)
	if err != nil {
		return false, "upstream log query failed: " + err.Error(), false
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Items []struct {
				Quota int `json:"quota"`
			} `json:"items"`
			Total int `json:"total"`
		} `json:"data"`
	}
	if json.Unmarshal(body, &resp) != nil || !resp.Success {
		return false, "upstream log query parse failed", false
	}
	if resp.Data.Total > 0 && len(resp.Data.Items) > 0 && resp.Data.Items[0].Quota > 0 {
		return true, fmt.Sprintf("upstream log shows consume quota=%d", resp.Data.Items[0].Quota), true
	}
	if resp.Data.Total == 0 {
		return false, "upstream has no consume log for request_id", true
	}
	return false, "", false
}

func fetchURLWithBearer(url, key string, channel *model.Channel) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	client, err := NewProxyHttpClient(channel.GetSetting().Proxy)
	if err != nil {
		return nil, err
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d: %s", res.StatusCode, string(body))
	}
	return body, nil
}

// RefundBillingHold 确认上游未扣款：退还预扣费。
func RefundBillingHold(hold *model.BillingHold, detail string) error {
	if hold == nil || hold.PreConsumedQuota <= 0 {
		return fmt.Errorf("invalid billing hold")
	}
	hasConsume, err := model.HasConsumeLogForRequestId(hold.UserId, hold.RequestId)
	if err != nil {
		return err
	}
	tokenKey := ""
	if hold.TokenId > 0 {
		token, err := model.GetTokenById(hold.TokenId)
		if err == nil && token != nil {
			tokenKey = token.Key
		}
	}
	if err := model.ResolveBillingHoldRefund(hold, hasConsume, detail, tokenKey); err != nil {
		return err
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    hold.UserId,
		LogType:   model.LogTypeRefund,
		Content:   fmt.Sprintf("预扣挂账对账退还 %s", logger.FormatQuota(hold.PreConsumedQuota)),
		Quota:     hold.PreConsumedQuota,
		TokenId:   hold.TokenId,
		ModelName: hold.ModelName,
		ChannelId: hold.ChannelId,
		Group:     hold.Group,
		RequestId: hold.RequestId,
		Other: map[string]interface{}{
			"billing_hold_reconcile": true,
			"request_id":             hold.RequestId,
			"verify_detail":          detail,
			"action":                 "refund",
		},
	})
	return nil
}

// ConfirmBillingHold 确认扣款：钱包/令牌已在预扣阶段扣除，补记 used_quota 并写入消费日志。
func ConfirmBillingHold(hold *model.BillingHold, detail string) error {
	if hold == nil || hold.PreConsumedQuota <= 0 {
		return fmt.Errorf("invalid billing hold")
	}
	hasConsume, err := model.HasConsumeLogForRequestId(hold.UserId, hold.RequestId)
	if err != nil {
		return err
	}
	if !hasConsume {
		if err := model.ResolveBillingHoldConfirm(hold, false, detail); err != nil {
			return err
		}
		model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
			UserId:    hold.UserId,
			LogType:   model.LogTypeConsume,
			Content:   fmt.Sprintf("预扣挂账对账确认消费 %s", logger.FormatQuota(hold.PreConsumedQuota)),
			Quota:     hold.PreConsumedQuota,
			TokenId:   hold.TokenId,
			ModelName: hold.ModelName,
			ChannelId: hold.ChannelId,
			Group:     hold.Group,
			RequestId: hold.RequestId,
			Other: map[string]interface{}{
				"billing_hold_reconcile": true,
				"request_id":             hold.RequestId,
				"verify_detail":          detail,
				"action":                 "confirm_charge",
			},
		})
		return nil
	}
	return model.ResolveBillingHoldConfirm(hold, true, detail)
}
