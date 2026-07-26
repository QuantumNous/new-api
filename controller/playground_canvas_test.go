package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPlaygroundCanvasAPIConflictAndNondisclosingNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for name, test := range map[string]struct {
		err      error
		status   int
		contains map[string]any
	}{
		"stale revision": {err: &service.PlaygroundCanvasConflict{CurrentRevision: 9}, status: http.StatusConflict, contains: map[string]any{"data": map[string]any{"current_revision": float64(9)}}},
		"not found":      {err: gorm.ErrRecordNotFound, status: http.StatusNotFound, contains: map[string]any{"message": "project not found"}},
	} {
		t.Run(name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			playgroundCanvasError(ctx, test.err)
			assert.Equal(t, test.status, recorder.Code)
			var response map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.Equal(t, false, response["success"])
			for key, expected := range test.contains {
				assert.Equal(t, expected, response[key])
			}
		})
	}
}
