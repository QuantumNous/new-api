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
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type recordingBillingSettler struct {
	settledQuotas   []int
	failures        int
	commitOnFailure bool
	refundCalls     int
}

func (s *recordingBillingSettler) Settle(actualQuota int) error {
	if s.failures > 0 {
		s.failures--
		if s.commitOnFailure {
			s.settledQuotas = append(s.settledQuotas, actualQuota)
		}
		return errors.New("injected settlement failure")
	}
	s.settledQuotas = append(s.settledQuotas, actualQuota)
	return nil
}

func (s *recordingBillingSettler) Refund(*gin.Context) {
	if s.NeedsRefund() {
		s.refundCalls++
	}
}
func (s *recordingBillingSettler) NeedsRefund() bool        { return len(s.settledQuotas) == 0 }
func (s *recordingBillingSettler) GetPreConsumedQuota() int { return 100 }
func (s *recordingBillingSettler) Reserve(int) error        { return nil }
func (s *recordingBillingSettler) settlementApplied() bool  { return len(s.settledQuotas) > 0 }

func newTextQuotaErrorTest(t *testing.T, billing *recordingBillingSettler, logConsume bool) (*gin.Context, *relaycommon.RelayInfo, *dto.Usage) {
	t.Helper()
	previousBatchUpdateEnabled := common.BatchUpdateEnabled
	previousLogConsumeEnabled := common.LogConsumeEnabled
	common.BatchUpdateEnabled = true
	common.LogConsumeEnabled = logConsume
	t.Cleanup(func() {
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
		common.LogConsumeEnabled = previousLogConsumeEnabled
	})

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
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
	return ctx, info, &dto.Usage{PromptTokens: 20, CompletionTokens: 5, TotalTokens: 25}
}

func TestPostTextConsumeQuotaOnErrorSettlementOutcomes(t *testing.T) {
	for _, test := range []struct {
		name                 string
		failures             int
		commitOnFailure      bool
		wantErr, wantApplied bool
		wantRetained         bool
		wantConsumeLogs      int
	}{
		{name: "settles delivered usage", wantApplied: true, wantConsumeLogs: 1},
		{name: "retains pre-consumption after settlement failure", failures: 1, wantErr: true, wantApplied: true, wantRetained: true, wantConsumeLogs: 1},
		{name: "does not replace a committed settlement after a late error", failures: 1, commitOnFailure: true, wantErr: true, wantApplied: true, wantConsumeLogs: 1},
		{name: "does not log when settlement and retention fail", failures: 2, wantErr: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			previousSpendHook := model.TemporaryChannelSpendHook
			consumeLogCalls := 0
			model.TemporaryChannelSpendHook = func(int, string, int) { consumeLogCalls++ }
			t.Cleanup(func() { model.TemporaryChannelSpendHook = previousSpendHook })

			billing := &recordingBillingSettler{failures: test.failures, commitOnFailure: test.commitOnFailure}
			ctx, info, usage := newTextQuotaErrorTest(t, billing, true)
			err := PostTextConsumeQuotaOnError(ctx, info, usage, nil)
			if (err != nil) != test.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, test.wantErr)
			}
			if billing.settlementApplied() != test.wantApplied || billing.NeedsRefund() == test.wantApplied {
				t.Fatalf("settlement applied=%v needsRefund=%v", billing.settlementApplied(), billing.NeedsRefund())
			}
			if consumeLogCalls != test.wantConsumeLogs {
				t.Fatalf("consume logs = %d, want %d", consumeLogCalls, test.wantConsumeLogs)
			}
			if test.wantApplied {
				gotRetained := billing.settledQuotas[0] == billing.GetPreConsumedQuota()
				if gotRetained != test.wantRetained {
					t.Fatalf("settled quotas = %v, retained=%v", billing.settledQuotas, gotRetained)
				}
			}
			billing.Refund(ctx)
			if test.wantApplied && billing.refundCalls != 0 {
				t.Fatalf("refund calls = %d", billing.refundCalls)
			}
		})
	}
}
