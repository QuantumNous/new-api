package kling

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseTaskResultSaturatesFinalUnitDeduction(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{"data":{"task_id":"task_1","task_status":"succeed","final_unit_deduction":"1e100"}}`)

	info, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %v, want success", info.Status)
	}
	if info.TotalTokens != math.MaxInt32 {
		t.Fatalf("total tokens = %d, want MaxInt32", info.TotalTokens)
	}
}
