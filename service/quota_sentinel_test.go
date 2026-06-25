package service

import (
	"errors"
	"fmt"
	"testing"
)

// The 3 PreConsumeTokenQuota call sites map only ErrInsufficientTokenQuota to 403;
// every other error must stay 5xx. These tests pin that contract.
func TestInsufficientTokenQuotaErrorMatchesSentinel(t *testing.T) {
	e := &insufficientTokenQuotaError{msg: "令牌额度不足, 令牌剩余额度: $0.10, 需要额度: $1.00"}

	if !errors.Is(e, ErrInsufficientTokenQuota) {
		t.Fatal("insufficientTokenQuotaError should match ErrInsufficientTokenQuota via errors.Is")
	}
	if e.Error() != "令牌额度不足, 令牌剩余额度: $0.10, 需要额度: $1.00" {
		t.Fatalf("unexpected message: %q", e.Error())
	}
}

func TestNonQuotaErrorsDoNotMatchSentinel(t *testing.T) {
	// DB/system errors that GetTokenByKey / DecreaseTokenQuota may surface must NOT
	// be misclassified as quota exhaustion.
	for _, err := range []error{
		errors.New("record not found"),
		fmt.Errorf("db: connection refused"),
		errors.New("额度不能为负数！"), // negative-quota invariant (plain errors.New, not the sentinel type)
	} {
		if errors.Is(err, ErrInsufficientTokenQuota) {
			t.Fatalf("non-quota error must not match sentinel: %v", err)
		}
	}
}
