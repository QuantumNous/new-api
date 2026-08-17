package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetModelRequestRecognizesArkContentGenerationTasks(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name                 string
		method               string
		path                 string
		body                 string
		wantModel            string
		wantRelayMode        int
		wantChannelSelection bool
	}{
		{
			name:                 "create task",
			method:               http.MethodPost,
			path:                 constant.ArkContentGenerationTasksPath,
			body:                 `{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"a sunrise"}]}`,
			wantModel:            "doubao-seedance-2-0-260128",
			wantRelayMode:        relayconstant.RelayModeVideoSubmit,
			wantChannelSelection: true,
		},
		{
			name:                 "fetch task",
			method:               http.MethodGet,
			path:                 constant.ArkContentGenerationTasksPath + "/task_public",
			wantRelayMode:        relayconstant.RelayModeVideoFetchByID,
			wantChannelSelection: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
			context.Request.Header.Set("Content-Type", "application/json")

			request, shouldSelectChannel, err := getModelRequest(context)

			require.NoError(t, err)
			require.NotNil(t, request)
			assert.Equal(t, test.wantModel, request.Model)
			assert.Equal(t, test.wantChannelSelection, shouldSelectChannel)
			assert.Equal(t, test.wantRelayMode, context.GetInt("relay_mode"))
		})
	}
}
