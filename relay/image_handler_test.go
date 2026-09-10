package relay

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/constant"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeImageResponseStatus(t *testing.T) {
	tests := []struct {
		name           string
		statusCode     int
		apiType        int
		wantStatusCode int
		wantAccepted   bool
	}{
		{
			name:           "standard success",
			statusCode:     http.StatusOK,
			apiType:        constant.APITypeOpenAI,
			wantStatusCode: http.StatusOK,
			wantAccepted:   true,
		},
		{
			name:           "replicate created prediction",
			statusCode:     http.StatusCreated,
			apiType:        constant.APITypeReplicate,
			wantStatusCode: http.StatusOK,
			wantAccepted:   true,
		},
		{
			name:           "replicate accepted pending prediction",
			statusCode:     http.StatusAccepted,
			apiType:        constant.APITypeReplicate,
			wantStatusCode: http.StatusOK,
			wantAccepted:   true,
		},
		{
			name:           "non-replicate accepted response",
			statusCode:     http.StatusAccepted,
			apiType:        constant.APITypeOpenAI,
			wantStatusCode: http.StatusAccepted,
			wantAccepted:   false,
		},
		{
			name:           "replicate upstream failure",
			statusCode:     http.StatusBadGateway,
			apiType:        constant.APITypeReplicate,
			wantStatusCode: http.StatusBadGateway,
			wantAccepted:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statusCode, accepted := normalizeImageResponseStatus(tt.statusCode, tt.apiType)
			assert.Equal(t, tt.wantStatusCode, statusCode)
			assert.Equal(t, tt.wantAccepted, accepted)
		})
	}
}
