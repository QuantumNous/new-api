package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseHTTPStatusCodeRanges_CommaSeparated(t *testing.T) {
	ranges, err := ParseHTTPStatusCodeRanges("401,403,500-599")
	require.NoError(t, err)
	require.Equal(t, []StatusCodeRange{
		{Start: 401, End: 401},
		{Start: 403, End: 403},
		{Start: 500, End: 599},
	}, ranges)
}

func TestParseHTTPStatusCodeRanges_MergeAndNormalize(t *testing.T) {
	ranges, err := ParseHTTPStatusCodeRanges("500-505,504,401,403,402")
	require.NoError(t, err)
	require.Equal(t, []StatusCodeRange{
		{Start: 401, End: 403},
		{Start: 500, End: 505},
	}, ranges)
}

func TestParseHTTPStatusCodeRanges_Invalid(t *testing.T) {
	_, err := ParseHTTPStatusCodeRanges("99,600,foo,500-400,500-")
	require.Error(t, err)
}

func TestParseHTTPStatusCodeRanges_NoComma_IsInvalid(t *testing.T) {
	_, err := ParseHTTPStatusCodeRanges("401 403")
	require.Error(t, err)
}

func TestShouldDisableByStatusCode(t *testing.T) {
	orig := AutomaticDisableStatusCodeRanges
	t.Cleanup(func() { AutomaticDisableStatusCodeRanges = orig })

	AutomaticDisableStatusCodeRanges = []StatusCodeRange{
		{Start: 401, End: 403},
		{Start: 500, End: 599},
	}

	require.True(t, ShouldDisableByStatusCode(401))
	require.True(t, ShouldDisableByStatusCode(403))
	require.False(t, ShouldDisableByStatusCode(404))
	require.True(t, ShouldDisableByStatusCode(500))
	require.False(t, ShouldDisableByStatusCode(200))
}

func TestShouldRetryByStatusCode(t *testing.T) {
	orig := AutomaticRetryStatusCodeRanges
	t.Cleanup(func() { AutomaticRetryStatusCodeRanges = orig })

	AutomaticRetryStatusCodeRanges = []StatusCodeRange{
		{Start: 429, End: 429},
		{Start: 500, End: 599},
	}

	require.True(t, ShouldRetryByStatusCode(429))
	require.True(t, ShouldRetryByStatusCode(500))
	require.False(t, ShouldRetryByStatusCode(504))
	require.False(t, ShouldRetryByStatusCode(524))
	require.False(t, ShouldRetryByStatusCode(400))
	require.False(t, ShouldRetryByStatusCode(200))
}

func TestShouldRetryByStatusCode_DefaultMatchesLegacyBehavior(t *testing.T) {
	require.False(t, ShouldRetryByStatusCode(200))
	require.False(t, ShouldRetryByStatusCode(400))
	require.True(t, ShouldRetryByStatusCode(401))
	require.False(t, ShouldRetryByStatusCode(408))
	require.True(t, ShouldRetryByStatusCode(429))
	require.True(t, ShouldRetryByStatusCode(500))
	require.False(t, ShouldRetryByStatusCode(504))
	require.False(t, ShouldRetryByStatusCode(524))
	require.True(t, ShouldRetryByStatusCode(599))
}

func TestIsAlwaysSkipRetryStatusCode(t *testing.T) {
	require.True(t, IsAlwaysSkipRetryStatusCode(504))
	require.True(t, IsAlwaysSkipRetryStatusCode(524))
	require.False(t, IsAlwaysSkipRetryStatusCode(500))
}

func TestIsBusinessErrorStatusCode_Default(t *testing.T) {
	// Restore the default ranges if a previous test mutated them.
	orig := BusinessErrorStatusCodeRanges
	t.Cleanup(func() { BusinessErrorStatusCodeRanges = orig })
	BusinessErrorStatusCodeRanges = []StatusCodeRange{
		{Start: 400, End: 400},
		{Start: 402, End: 402},
		{Start: 403, End: 403},
		{Start: 422, End: 422},
		{Start: 451, End: 451},
	}
	for _, code := range []int{400, 402, 403, 422, 451} {
		require.Truef(t, IsBusinessErrorStatusCode(code),
			"expected business for status %d", code)
	}
	// Negative cases: success, 5xx, 408 (408 is a temp error, not business),
	// 401 (auth, neither business nor auto-disabled by the default rules).
	for _, code := range []int{200, 401, 408, 500, 503, 599} {
		require.Falsef(t, IsBusinessErrorStatusCode(code),
			"expected non-business for status %d", code)
	}
}

func TestBusinessErrorStatusCodesFromString(t *testing.T) {
	orig := BusinessErrorStatusCodeRanges
	t.Cleanup(func() { BusinessErrorStatusCodeRanges = orig })

	require.NoError(t, BusinessErrorStatusCodesFromString("400,402-403,422"))
	require.Equal(t, []StatusCodeRange{
		{Start: 400, End: 400},
		{Start: 402, End: 403},
		{Start: 422, End: 422},
	}, BusinessErrorStatusCodeRanges)
}
