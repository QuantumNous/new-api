package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseHTTPStatusCodeRanges_CommaSeparated(t *testing.T) {
	ranges, err := ParseHTTPStatusCodeRanges("401,403,500-599")
	require.NoError(t, err)
	assert.Equal(t, []StatusCodeRange{
		{Start: 401, End: 401},
		{Start: 403, End: 403},
		{Start: 500, End: 599},
	}, ranges)
}

func TestParseHTTPStatusCodeRanges_MergeAndNormalize(t *testing.T) {
	ranges, err := ParseHTTPStatusCodeRanges("500-505,504,401,403,402")
	require.NoError(t, err)
	assert.Equal(t, []StatusCodeRange{
		{Start: 401, End: 403},
		{Start: 500, End: 505},
	}, ranges)
}

func TestParseHTTPStatusCodeRanges_Empty(t *testing.T) {
	ranges, err := ParseHTTPStatusCodeRanges("")
	require.NoError(t, err)
	assert.Empty(t, ranges)
}

func TestParseHTTPStatusCodeRanges_InvalidEntry(t *testing.T) {
	_, err := ParseHTTPStatusCodeRanges("200,abc,500")
	require.Error(t, err)
}

func TestParseHTTPStatusCodeRanges_OutOfRange(t *testing.T) {
	_, err := ParseHTTPStatusCodeRanges("99")
	require.Error(t, err)
}

func TestShouldMatchStatusCodeRanges(t *testing.T) {
	ranges := []StatusCodeRange{{Start: 400, End: 410}}
	assert.True(t, shouldMatchStatusCodeRanges(ranges, 400))
	assert.True(t, shouldMatchStatusCodeRanges(ranges, 410))
	assert.False(t, shouldMatchStatusCodeRanges(ranges, 399))
	assert.False(t, shouldMatchStatusCodeRanges(ranges, 411))
	// Out-of-band codes are never matched.
	assert.False(t, shouldMatchStatusCodeRanges(ranges, 99))
	assert.False(t, shouldMatchStatusCodeRanges(ranges, 600))
}

func TestStatusCodeRangesToString(t *testing.T) {
	ranges := []StatusCodeRange{
		{Start: 200, End: 200},
		{Start: 400, End: 410},
		{Start: 500, End: 503},
	}
	assert.Equal(t, "200,400-410,500-503", statusCodeRangesToString(ranges))
}

func TestAutomaticRetryStatusCodesFromString(t *testing.T) {
	orig := AutomaticRetryStatusCodeRanges
	t.Cleanup(func() { AutomaticRetryStatusCodeRanges = orig })

	require.NoError(t, AutomaticRetryStatusCodesFromString("500-503,401,402,403"))
	assert.Equal(t, []StatusCodeRange{
		{Start: 401, End: 403},
		{Start: 500, End: 503},
	}, AutomaticRetryStatusCodeRanges)
}

func TestAutomaticDisableStatusCodesFromString(t *testing.T) {
	orig := AutomaticDisableStatusCodeRanges
	t.Cleanup(func() { AutomaticDisableStatusCodeRanges = orig })

	require.NoError(t, AutomaticDisableStatusCodesFromString("401"))
	assert.Equal(t, []StatusCodeRange{{Start: 401, End: 401}},
		AutomaticDisableStatusCodeRanges)
}

func TestShouldDisableByStatusCode(t *testing.T) {
	assert.True(t, ShouldDisableByStatusCode(401))
	assert.False(t, ShouldDisableByStatusCode(500))
}

func TestShouldRetryByStatusCode_DefaultMatchesLegacyBehavior(t *testing.T) {
	assert.False(t, ShouldRetryByStatusCode(200))
	assert.False(t, ShouldRetryByStatusCode(400))
	assert.True(t, ShouldRetryByStatusCode(401))
	assert.False(t, ShouldRetryByStatusCode(408))
	assert.True(t, ShouldRetryByStatusCode(429))
	assert.True(t, ShouldRetryByStatusCode(500))
	assert.False(t, ShouldRetryByStatusCode(504))
	assert.False(t, ShouldRetryByStatusCode(524))
	assert.True(t, ShouldRetryByStatusCode(599))
}

func TestIsAlwaysSkipRetryStatusCode(t *testing.T) {
	assert.True(t, IsAlwaysSkipRetryStatusCode(504))
	assert.True(t, IsAlwaysSkipRetryStatusCode(524))
	assert.False(t, IsAlwaysSkipRetryStatusCode(500))
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
		assert.Truef(t, IsBusinessErrorStatusCode(code),
			"expected business for status %d", code)
	}
	// Negative cases: success, 5xx, 408 (408 is a temp error, not business),
	// 401 (auth, neither business nor auto-disabled by the default rules).
	for _, code := range []int{200, 401, 408, 500, 503, 599} {
		assert.Falsef(t, IsBusinessErrorStatusCode(code),
			"expected non-business for status %d", code)
	}
}

func TestBusinessErrorStatusCodesFromString(t *testing.T) {
	orig := BusinessErrorStatusCodeRanges
	t.Cleanup(func() { BusinessErrorStatusCodeRanges = orig })

	require.NoError(t, BusinessErrorStatusCodesFromString("400,402-403,422"))
	assert.Equal(t, []StatusCodeRange{
		{Start: 400, End: 400},
		{Start: 402, End: 403},
		{Start: 422, End: 422},
	}, BusinessErrorStatusCodeRanges)
}
