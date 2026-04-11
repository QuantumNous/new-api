package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRespondTaskError_PreservesGovernor429Message(t *testing.T) {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)

	taskErr := &dto.TaskError{
		Code:       string(types.ErrorCodeGovernorSelectionRejected),
		Message:    "all candidate channels are cooling or saturated",
		StatusCode: http.StatusTooManyRequests,
	}

	respondTaskError(ctx, taskErr)

	require.Equal(t, http.StatusTooManyRequests, rec.Code)

	var payload dto.TaskError
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	require.Equal(t, string(types.ErrorCodeGovernorSelectionRejected), payload.Code)
	require.Equal(t, "all candidate channels are cooling or saturated", payload.Message)
}
