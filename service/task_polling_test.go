package service

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

func TestJSONRawMessageEqual(t *testing.T) {
	tests := []struct {
		name  string
		left  json.RawMessage
		right json.RawMessage
		want  bool
	}{
		{
			name:  "exact match ignores surrounding whitespace",
			left:  json.RawMessage(` {"a":1} `),
			right: json.RawMessage(`{"a":1}`),
			want:  true,
		},
		{
			name:  "object key order is semantic match",
			left:  json.RawMessage(`{"b":2,"a":1}`),
			right: json.RawMessage(`{"a":1,"b":2}`),
			want:  true,
		},
		{
			name:  "same byte multiset is not semantic match",
			left:  json.RawMessage(`{"a":12}`),
			right: json.RawMessage(`{"a":21}`),
			want:  false,
		},
		{
			name:  "invalid json falls back to trimmed byte comparison",
			left:  json.RawMessage(`{"a":1`),
			right: json.RawMessage(`{"a":1 }`),
			want:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := jsonRawMessageEqual(tt.left, tt.right); got != tt.want {
				t.Fatalf("jsonRawMessageEqual() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestTaskNeedsUpdateComparesDataSemantically(t *testing.T) {
	oldTask := &model.Task{
		Status:     model.TaskStatusInProgress,
		SubmitTime: 100,
		StartTime:  110,
		FinishTime: 0,
		Data:       json.RawMessage(`{"clips":{"b":{"id":"2"},"a":{"id":"1"}}}`),
	}
	sameTask := dto.SunoDataResponse{
		Status:     string(model.TaskStatusInProgress),
		SubmitTime: 100,
		StartTime:  110,
		FinishTime: 0,
		Data:       json.RawMessage(`{"clips":{"a":{"id":"1"},"b":{"id":"2"}}}`),
	}
	if taskNeedsUpdate(oldTask, sameTask) {
		t.Fatal("taskNeedsUpdate() returned true for semantically identical data")
	}

	changedTask := sameTask
	changedTask.Data = json.RawMessage(`{"clips":{"a":{"id":"1"},"b":{"id":"3"}}}`)
	if !taskNeedsUpdate(oldTask, changedTask) {
		t.Fatal("taskNeedsUpdate() returned false for changed data")
	}
}
