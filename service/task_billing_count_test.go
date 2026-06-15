package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

// taskBillingOther must only stamp count_billing for per-call/per-count tasks.
// Token-billed tasks (PerCallBilling=false, settled via
// RecalculateTaskQuotaByTokens) keep their token usage so reconciliation does
// not mis-classify them as 1-个 count billing. LogTaskConsumption gates the
// submit log on the same condition (TaskPricePatches ∪ PriceData.UsePrice,
// i.e. controller/relay.go's PerCallBilling definition).
func TestTaskBillingOther_CountBillingGate(t *testing.T) {
	cases := []struct {
		name    string
		bc      *model.TaskBillingContext
		wantSet bool
	}{
		{"per-call → count", &model.TaskBillingContext{PerCallBilling: true}, true},
		{"token-billed → no count", &model.TaskBillingContext{PerCallBilling: false}, false},
		{"nil context → conservative count", nil, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			task := &model.Task{
				Properties:  model.Properties{OriginModelName: "test-model"},
				PrivateData: model.TaskPrivateData{BillingContext: c.bc},
			}
			other := taskBillingOther(task)
			v, ok := other["count_billing"]
			if c.wantSet {
				if !ok || v != true {
					t.Fatalf("expected count_billing=true, got %v (present=%v)", v, ok)
				}
			} else if ok {
				t.Fatalf("expected count_billing absent for token-billed task, got %v", v)
			}
		})
	}
}
