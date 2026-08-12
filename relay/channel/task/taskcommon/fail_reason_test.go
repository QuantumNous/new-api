package taskcommon

import "testing"

func TestClassifyFailReason_Audit(t *testing.T) {
	if ClassifyFailReason("content audit rejected") != FailReasonAudit {
		t.Fatal("expected audit")
	}
	if ClassifyFailReason("审核不通过") != FailReasonAudit {
		t.Fatal("expected audit")
	}
	if !IsAuditFailReason("moderation blocked") {
		t.Fatal("expected audit")
	}
}

func TestClassifyFailReason_UpstreamBalance(t *testing.T) {
	if ClassifyFailReason("余额不足") != FailReasonUpstreamBalance {
		t.Fatal("expected upstream balance")
	}
	if ClassifyFailReason("insufficient quota") != FailReasonUpstreamBalance {
		t.Fatal("expected upstream balance")
	}
	if !IsUpstreamBalanceFailReason("payment required") {
		t.Fatal("expected upstream balance")
	}
}

func TestClassifyFailReason_Retryable(t *testing.T) {
	if ClassifyFailReason("internal server error") != FailReasonRetryable {
		t.Fatal("should be retryable")
	}
	if ClassifyFailReason("timeout") != FailReasonRetryable {
		t.Fatal("should be retryable")
	}
}

func TestBlocksSameChannelResubmit(t *testing.T) {
	if !BlocksSameChannelResubmit("audit failed") {
		t.Fatal("audit should block same-channel")
	}
	if !BlocksSameChannelResubmit("余额不足") {
		t.Fatal("balance should block same-channel")
	}
	if BlocksSameChannelResubmit("timeout") {
		t.Fatal("timeout should allow same-channel")
	}
}
