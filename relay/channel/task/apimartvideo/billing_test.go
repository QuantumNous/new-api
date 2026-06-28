package apimartvideo

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestRecalcMotionControlQuotaAdjustsSeconds(t *testing.T) {
	task := &model.Task{
		Quota: 30000,
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				OtherRatios: map[string]float64{
					"seconds": 3,
					"mode":    1,
				},
			},
		},
	}
	got := recalcMotionControlQuota(task, 4)
	require.Equal(t, 40000, got)
}

func TestRecalcMotionControlQuotaNoChange(t *testing.T) {
	task := &model.Task{
		Quota: 30000,
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				OtherRatios: map[string]float64{
					"seconds": 3,
					"mode":    1,
				},
			},
		},
	}
	require.Equal(t, 0, recalcMotionControlQuota(task, 3))
}

func TestExtractBillableSecondsFromApimart(t *testing.T) {
	body := []byte(`{"data":{"duration":4.2,"status":"completed"}}`)
	require.Equal(t, 5, extractBillableSecondsFromApimart(body))
}
