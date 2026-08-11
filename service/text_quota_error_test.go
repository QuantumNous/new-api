package service

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type recordingBillingSettler struct {
	settledQuotas   []int
	failNext        bool
	commitOnFailure bool
	refundCalls     int
}

func (s *recordingBillingSettler) Settle(actualQuota int) error {
	if s.failNext {
		s.failNext = false
		if s.commitOnFailure {
			s.settledQuotas = append(s.settledQuotas, actualQuota)
		}
		return errors.New("injected settlement failure")
	}
	s.settledQuotas = append(s.settledQuotas, actualQuota)
	return nil
}

func TestPostTextConsumeQuotaOnErrorDoesNotReplaceCommittedSettlementAfterLateError(t *testing.T) {
	previousBatchUpdateEnabled := common.BatchUpdateEnabled
	previousLogConsumeEnabled := common.LogConsumeEnabled
	common.BatchUpdateEnabled = true
	common.LogConsumeEnabled = false
	t.Cleanup(func() {
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
		common.LogConsumeEnabled = previousLogConsumeEnabled
	})

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	billing := &recordingBillingSettler{failNext: true, commitOnFailure: true}
	info := &relaycommon.RelayInfo{
		StartTime:       time.Now(),
		OriginModelName: "gpt-5.6-sol",
		IsStream:        true,
		IsPlayground:    true,
		Billing:         billing,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeCodex},
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
	}

	err := PostTextConsumeQuotaOnError(ctx, info, &dto.Usage{PromptTokens: 20, CompletionTokens: 5, TotalTokens: 25}, nil)
	if err == nil {
		t.Fatal("expected late settlement error")
	}
	if len(billing.settledQuotas) != 1 || billing.settledQuotas[0] == billing.GetPreConsumedQuota() {
		t.Fatalf("settled quotas = %v, actual settlement must not be replaced by pre-consumption", billing.settledQuotas)
	}
}

func (s *recordingBillingSettler) Refund(*gin.Context) {
	if s.NeedsRefund() {
		s.refundCalls++
	}
}
func (s *recordingBillingSettler) NeedsRefund() bool        { return len(s.settledQuotas) == 0 }
func (s *recordingBillingSettler) GetPreConsumedQuota() int { return 100 }
func (s *recordingBillingSettler) Reserve(int) error        { return nil }

func TestPostTextConsumeQuotaOnErrorSettlesDeliveredUsage(t *testing.T) {
	previousBatchUpdateEnabled := common.BatchUpdateEnabled
	previousLogConsumeEnabled := common.LogConsumeEnabled
	common.BatchUpdateEnabled = true
	common.LogConsumeEnabled = false
	t.Cleanup(func() {
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
		common.LogConsumeEnabled = previousLogConsumeEnabled
	})

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	billing := &recordingBillingSettler{}
	info := &relaycommon.RelayInfo{
		StartTime:       time.Now(),
		OriginModelName: "gpt-5.6-sol",
		IsStream:        true,
		IsPlayground:    true,
		Billing:         billing,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeCodex,
		},
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
	}
	usage := &dto.Usage{PromptTokens: 20, CompletionTokens: 5, TotalTokens: 25}

	if err := PostTextConsumeQuotaOnError(ctx, info, usage, []string{"partial stream failed"}); err != nil {
		t.Fatalf("settle delivered usage: %v", err)
	}

	if len(billing.settledQuotas) != 1 {
		t.Fatalf("settle calls = %d, want 1", len(billing.settledQuotas))
	}
	if billing.settledQuotas[0] <= 0 {
		t.Fatalf("settled quota = %d, want positive delivered usage charge", billing.settledQuotas[0])
	}
	if billing.NeedsRefund() {
		t.Fatal("settled billing must not remain refundable")
	}
}

func TestPostTextConsumeQuotaOnErrorRetainsPreConsumptionWhenActualSettlementFails(t *testing.T) {
	previousBatchUpdateEnabled := common.BatchUpdateEnabled
	previousLogConsumeEnabled := common.LogConsumeEnabled
	common.BatchUpdateEnabled = true
	common.LogConsumeEnabled = false
	t.Cleanup(func() {
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
		common.LogConsumeEnabled = previousLogConsumeEnabled
	})

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	billing := &recordingBillingSettler{failNext: true}
	info := &relaycommon.RelayInfo{
		StartTime:       time.Now(),
		OriginModelName: "gpt-5.6-sol",
		IsStream:        true,
		IsPlayground:    true,
		Billing:         billing,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeCodex},
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
	}

	err := PostTextConsumeQuotaOnError(ctx, info, &dto.Usage{PromptTokens: 20, CompletionTokens: 5, TotalTokens: 25}, nil)
	if err == nil {
		t.Fatal("expected original settlement failure")
	}
	if len(billing.settledQuotas) != 1 || billing.settledQuotas[0] != billing.GetPreConsumedQuota() {
		t.Fatalf("retained quotas = %v, want pre-consumed quota %d", billing.settledQuotas, billing.GetPreConsumedQuota())
	}
	billing.Refund(ctx)
	if billing.refundCalls != 0 || billing.NeedsRefund() {
		t.Fatalf("refund lifecycle: calls=%d needsRefund=%v", billing.refundCalls, billing.NeedsRefund())
	}
}
