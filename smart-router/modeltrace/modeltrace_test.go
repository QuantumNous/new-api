package modeltrace

import (
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestStateMachineAllowsOnlyDefinedTransitions(t *testing.T) {
	machine := NewMemory()
	now := time.Unix(100, 0)
	trace, err := machine.Create("trace-1", now)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if trace.State != StatePending {
		t.Fatalf("initial state = %q, want pending", trace.State)
	}
	trace, err = machine.Transition("trace-1", EventStart, now.Add(time.Second))
	if err != nil || trace.State != StateRunning {
		t.Fatalf("start transition = %#v, %v", trace, err)
	}
	trace, err = machine.Transition("trace-1", EventSucceed, now.Add(2*time.Second))
	if err != nil || trace.State != StateSucceeded {
		t.Fatalf("success transition = %#v, %v", trace, err)
	}
	if _, err := machine.Transition("trace-1", EventFail, now.Add(3*time.Second)); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("terminal transition error = %v, want ErrInvalidTransition", err)
	}
}

func TestStateMachineRejectsSkippedAndBackwardTimeTransitions(t *testing.T) {
	machine := NewMemory()
	now := time.Unix(100, 0)
	if _, err := machine.Create("trace-1", now); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := machine.Transition("trace-1", EventSucceed, now.Add(time.Second)); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("skipped transition error = %v, want ErrInvalidTransition", err)
	}
	if _, err := machine.Transition("trace-1", EventStart, now.Add(-time.Second)); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("backward transition error = %v, want ErrInvalidTransition", err)
	}
}

func TestTraceContainsNoPromptOrProviderBodyFields(t *testing.T) {
	TestTraceJSONRejectsRawEvidenceFields(t)
}

func TestTraceJSONRejectsRawEvidenceFields(t *testing.T) {
	traceType := reflect.TypeOf(Trace{})
	for _, name := range []string{"Prompt", "ProviderBody", "APIKey", "Numbers"} {
		if _, exists := traceType.FieldByName(name); exists {
			t.Errorf("Trace contains forbidden field %s", name)
		}
	}
}
