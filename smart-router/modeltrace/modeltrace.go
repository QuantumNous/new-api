package modeltrace

import (
	"errors"
	"sync"
	"time"
)

var (
	ErrDuplicateTrace    = errors.New("trace already exists")
	ErrTraceNotFound     = errors.New("trace not found")
	ErrInvalidTransition = errors.New("invalid trace transition")
)

type State string

const (
	StatePending   State = "pending"
	StateRunning   State = "running"
	StateSucceeded State = "succeeded"
	StateFailed    State = "failed"
	StateCancelled State = "cancelled"
)

type Event string

const (
	EventStart   Event = "start"
	EventSucceed Event = "succeed"
	EventFail    Event = "fail"
	EventCancel  Event = "cancel"
)

type Trace struct {
	ID        string    `json:"id"`
	State     State     `json:"state"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ModelTrace interface {
	Create(id string, at time.Time) (Trace, error)
	Transition(id string, event Event, at time.Time) (Trace, error)
	Get(id string) (Trace, error)
}

type Memory struct {
	mu     sync.RWMutex
	traces map[string]Trace
}

func NewMemory() *Memory {
	return &Memory{traces: make(map[string]Trace)}
}

func (memory *Memory) Create(id string, at time.Time) (Trace, error) {
	memory.mu.Lock()
	defer memory.mu.Unlock()
	if id == "" {
		return Trace{}, errors.New("trace ID is required")
	}
	if _, exists := memory.traces[id]; exists {
		return Trace{}, ErrDuplicateTrace
	}
	trace := Trace{ID: id, State: StatePending, CreatedAt: at, UpdatedAt: at}
	memory.traces[id] = trace
	return trace, nil
}

func (memory *Memory) Transition(id string, event Event, at time.Time) (Trace, error) {
	memory.mu.Lock()
	defer memory.mu.Unlock()
	trace, exists := memory.traces[id]
	if !exists {
		return Trace{}, ErrTraceNotFound
	}
	if at.Before(trace.UpdatedAt) {
		return Trace{}, ErrInvalidTransition
	}
	next, valid := nextState(trace.State, event)
	if !valid {
		return Trace{}, ErrInvalidTransition
	}
	trace.State = next
	trace.UpdatedAt = at
	memory.traces[id] = trace
	return trace, nil
}

func (memory *Memory) Get(id string) (Trace, error) {
	memory.mu.RLock()
	defer memory.mu.RUnlock()
	trace, exists := memory.traces[id]
	if !exists {
		return Trace{}, ErrTraceNotFound
	}
	return trace, nil
}

func nextState(current State, event Event) (State, bool) {
	switch current {
	case StatePending:
		switch event {
		case EventStart:
			return StateRunning, true
		case EventCancel:
			return StateCancelled, true
		}
	case StateRunning:
		switch event {
		case EventSucceed:
			return StateSucceeded, true
		case EventFail:
			return StateFailed, true
		case EventCancel:
			return StateCancelled, true
		}
	}
	return "", false
}
