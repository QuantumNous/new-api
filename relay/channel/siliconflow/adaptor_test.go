package siliconflow

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertImageRequestRejectsInvalidBatchSize(t *testing.T) {
	t.Parallel()

	wantError := fmt.Sprintf("batch_size must be an integer between 1 and %d", dto.MaxImageN)
	tests := []struct {
		name      string
		batchSize string
	}{
		{name: "zero", batchSize: "0"},
		{name: "negative", batchSize: "-1"},
		{name: "above maximum", batchSize: fmt.Sprintf("%d", dto.MaxImageN+1)},
		{name: "fractional", batchSize: "1.5"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			n := uint(1)
			request := dto.ImageRequest{
				Model:  "black-forest-labs/FLUX.1-schnell",
				Prompt: "a lighthouse",
				N:      &n,
				Extra: map[string]json.RawMessage{
					"batch_size": json.RawMessage(tt.batchSize),
				},
			}

			_, err := (&Adaptor{}).ConvertImageRequest(
				gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
				&relaycommon.RelayInfo{},
				request,
			)

			require.Error(t, err)
			require.Contains(t, err.Error(), wantError)
		})
	}
}

func TestConvertImageRequestAcceptsMaximumBatchSize(t *testing.T) {
	t.Parallel()

	request := dto.ImageRequest{
		Model:  "black-forest-labs/FLUX.1-schnell",
		Prompt: "a lighthouse",
		Extra: map[string]json.RawMessage{
			"batch_size": json.RawMessage(fmt.Sprintf("%d", dto.MaxImageN)),
		},
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&relaycommon.RelayInfo{},
		request,
	)
	require.NoError(t, err)

	payload, ok := converted.(*SFImageRequest)
	require.True(t, ok)
	require.Equal(t, uint(dto.MaxImageN), payload.BatchSize)
}
