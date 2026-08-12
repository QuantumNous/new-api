package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/types"
)

func TestEvaluateSafeFailoverRejectsChineseSafetySignals(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("内容审计拒绝"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)
	decision := EvaluateSafeFailover(SafeFailoverInput{Error: err, MaxAttempts: 1})
	if decision.Retry || decision.Reason != "content_safety" {
		t.Fatalf("got %+v, want non-retry content_safety", decision)
	}
}

func TestEvaluateSafeFailoverRejectsChineseAcceptanceSignals(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("请求已受理，正在生成"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)
	decision := EvaluateSafeFailover(SafeFailoverInput{Error: err, MaxAttempts: 1})
	if decision.Retry || decision.Reason != "upstream_accepted" {
		t.Fatalf("got %+v, want non-retry upstream_accepted", decision)
	}
}
