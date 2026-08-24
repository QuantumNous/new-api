package relay

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestSoniloSubmitStatusErrorIsWhitelabeled(t *testing.T) {
	err := taskSubmitStatusError(constant.TaskPlatform("109"), &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       io.NopCloser(strings.NewReader(`{"error":"api.sonilo.com rejected secret upstream id"}`)),
	})
	require.Equal(t, "task failed at upstream provider", err.Message)
}
