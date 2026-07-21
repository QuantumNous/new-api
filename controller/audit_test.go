package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAuditContentTemplatesCoverAtomicModelAndOptionUpdates(t *testing.T) {
	testCases := []struct {
		action   string
		params   map[string]interface{}
		expected string
	}{
		{
			action:   "option.update_batch",
			params:   map[string]interface{}{"keys": "ModelPrice, ImageResolutionPrice"},
			expected: "Updated system settings ModelPrice, ImageResolutionPrice",
		},
		{
			action: "model.create_with_options",
			params: map[string]interface{}{
				"model_id": 42, "model_name": "image-model", "option_keys": "ModelPrice, ImageResolutionPrice",
			},
			expected: "Created model image-model (ID: 42) with settings ModelPrice, ImageResolutionPrice",
		},
		{
			action: "model.update_with_options",
			params: map[string]interface{}{
				"model_id": 42, "model_name": "image-model", "option_keys": "ImageResolutionPrice",
			},
			expected: "Updated model image-model (ID: 42) with settings ImageResolutionPrice",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.action, func(t *testing.T) {
			assert.Equal(t, testCase.expected, auditContentEN(testCase.action, testCase.params))
		})
	}
}
