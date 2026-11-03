package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	taskdto "github.com/QuantumNous/new-api/internal/dto"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
)

// TestShouldRetryTaskRelay_ClientCancelStopsLoop is the task-loop half of the
// client-cancel fix: a canceled submission surfaces as a 5xx TaskError, which
// the retry rules treat as switchable — so the loop kept dialing new upstream
// candidates for a client that already left.
func TestShouldRetryTaskRelay_ClientCancelStopsLoop(t *testing.T) {
	c, _ := fiberadapter.NewSyntheticContext(nil)

	canceled := &taskdto.TaskError{
		StatusCode: http.StatusInternalServerError,
		Error:      fmt.Errorf("do request failed: %w", context.Canceled),
	}
	assert.False(t, shouldRetryTaskRelay(c, 7, canceled, 3),
		"a client cancel must end the task relay loop")

	real500 := &taskdto.TaskError{
		StatusCode: http.StatusInternalServerError,
		Error:      errors.New("upstream exploded"),
	}
	assert.True(t, shouldRetryTaskRelay(c, 7, real500, 3),
		"a real upstream 5xx keeps its retry eligibility")
}
