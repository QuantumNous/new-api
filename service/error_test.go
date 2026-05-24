package service

import (
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestResetStatusCode(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name             string
		statusCode       int
		statusCodeConfig string
		expectedCode     int
	}{
		{
			name:             "map string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"503"}`,
			expectedCode:     503,
		},
		{
			name:             "map int value",
			statusCode:       429,
			statusCodeConfig: `{"429":503}`,
			expectedCode:     503,
		},
		{
			name:             "skip invalid string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"bad-code"}`,
			expectedCode:     429,
		},
		{
			name:             "skip status code 200",
			statusCode:       200,
			statusCodeConfig: `{"200":503}`,
			expectedCode:     200,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			newAPIError := &types.NewAPIError{
				StatusCode: tc.statusCode,
			}
			ResetStatusCode(newAPIError, tc.statusCodeConfig)
			require.Equal(t, tc.expectedCode, newAPIError.StatusCode)
		})
	}
}

func TestApplyChannelErrorOverrides(t *testing.T) {
	t.Parallel()

	newAPIError := types.NewOpenAIError(
		require.AnError,
		types.ErrorCodeBadResponseStatusCode,
		429,
	)

	summary := ApplyChannelErrorOverrides(
		newAPIError,
		`{"429":"503"}`,
		`{"429":"channel is busy, please retry later"}`,
	)

	require.Equal(t, 503, newAPIError.StatusCode)
	require.Equal(t, "channel is busy, please retry later", newAPIError.Error())
	require.Equal(t, "channel is busy, please retry later", newAPIError.ToOpenAIError().Message)
	require.NotNil(t, summary)
	require.Equal(t, 429, summary.OriginalStatusCode)
	require.Equal(t, 503, summary.FinalStatusCode)
	require.True(t, summary.StatusCodeRewritten)
	require.True(t, summary.MessageRewritten)
}

func TestApplyChannelErrorOverridesFallsBackToRewrittenStatusCode(t *testing.T) {
	t.Parallel()

	newAPIError := types.NewOpenAIError(
		require.AnError,
		types.ErrorCodeBadResponseStatusCode,
		429,
	)

	summary := ApplyChannelErrorOverrides(
		newAPIError,
		`{"429":"503"}`,
		`{"503":"upstream temporarily unavailable"}`,
	)

	require.Equal(t, 503, newAPIError.StatusCode)
	require.Equal(t, "upstream temporarily unavailable", newAPIError.Error())
	require.NotNil(t, summary)
	require.Equal(t, "upstream temporarily unavailable", summary.FinalMessage)
}
