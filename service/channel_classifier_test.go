package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withBusinessKeywords temporarily replaces the package-level
// BusinessErrorKeywords slice so individual tests can pin the
// classifier to a known keyword list without depending on the
// operator-tunable defaults. It restores the original value via
// t.Cleanup. The atomic setter is used (rather than a direct
// write) so concurrent test runs against the same global don't
// race on the underlying slice.
func withBusinessKeywords(t *testing.T, kws []string) {
	t.Helper()
	orig := operation_setting.BusinessErrorKeywordsSnapshot()
	operation_setting.SetBusinessErrorKeywordsForTest(kws)
	t.Cleanup(func() { operation_setting.SetBusinessErrorKeywordsForTest(orig) })
}

func TestClassifyChannelError_Nil(t *testing.T) {
	assert.Equal(t, ChannelErrorUnknown, ClassifyChannelError(nil))
}

func TestClassifyChannelError_BusinessByStatusCode(t *testing.T) {
	// The default BusinessErrorStatusCodeRanges includes 400/402/403/422/451.
	// We test a couple to be robust against config changes.
	for _, code := range []int{400, 402, 403, 422, 451} {
		err := &types.NewAPIError{StatusCode: code}
		assert.Equalf(t, ChannelErrorBusiness, ClassifyChannelError(err),
			"expected business for status %d", code)
	}
}

func TestClassifyChannelError_BusinessByKeyword(t *testing.T) {
	withBusinessKeywords(t, []string{"overdue", "insufficient balance"})

	cases := []struct {
		name string
		msg  string
	}{
		{"lowercase", "access denied: account is overdue"},
		{"uppercase", "ACCESS DENIED: ACCOUNT IS OVERDUE"},
		{"mixed_case", "Overdue-Payment detected on key"},
		{"alt_keyword", "insufficient balance on request"},
		{"unrelated_message", "this is a normal completion"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := &types.NewAPIError{StatusCode: 500, Err: errorFromString(tc.msg)}
			kind := ClassifyChannelError(err)
			if tc.name == "unrelated_message" {
				// 500 with no business keyword and no temp keyword is
				// unknown. We can't strictly assert Unknown here because
				// other status-code based heuristics might fire, but the
				// message alone must not produce a business
				// classification.
				assert.NotEqual(t, ChannelErrorBusiness, kind)
			} else {
				assert.Equal(t, ChannelErrorBusiness, kind,
					"expected business for message %q", tc.msg)
			}
		})
	}
}

func TestClassifyChannelError_TempByStatusCode(t *testing.T) {
	// 5xx codes fall in ShouldRetryByStatusCode's default range.
	for _, code := range []int{500, 502, 503, 599} {
		err := &types.NewAPIError{StatusCode: code}
		assert.Equalf(t, ChannelErrorTemp, ClassifyChannelError(err),
			"expected temp for status %d", code)
	}
}

func TestClassifyChannelError_UnknownFor2xx(t *testing.T) {
	// 2xx is not a business or temp error; we never see it through this
	// path, but the classifier must not return a wrong class.
	err := &types.NewAPIError{StatusCode: 200}
	assert.Equal(t, ChannelErrorUnknown, ClassifyChannelError(err))
}

func TestClassifyChannelError_BusinessBeatsTemp(t *testing.T) {
	// A 400 must classify as business, not temp, even though 4xx
	// is technically in the retry list (4xx except 400/408 — and
	// 400 is excluded from the temp list already). Pin both directions.
	err := &types.NewAPIError{StatusCode: 400}
	assert.Equal(t, ChannelErrorBusiness, ClassifyChannelError(err))
}

func TestClassifyChannelError_BusinessKeywordBeatsTempStatus(t *testing.T) {
	// Hypothetical upstream that returns 500 with a body that says
	// "suspended". The keyword match must win so the cooldown is
	// long (operator chose this keyword for a reason).
	withBusinessKeywords(t, []string{"suspended"})
	err := &types.NewAPIError{
		StatusCode: 500,
		Err:        errorFromString("account suspended, contact support"),
	}
	assert.Equal(t, ChannelErrorBusiness, ClassifyChannelError(err))
}

func TestMessageMatchesBusinessKeyword_EmptyMessage(t *testing.T) {
	assert.False(t, messageMatchesBusinessKeyword(""))
}

func TestMessageMatchesBusinessKeyword_EmptyKeywords(t *testing.T) {
	withBusinessKeywords(t, nil)
	assert.False(t, messageMatchesBusinessKeyword("anything goes here"))
}

// errorFromString builds a minimal error for use in test inputs. We
// don't want a real error to leak into production paths, but
// NewAPIError.Err is the source string the classifier matches against.
func errorFromString(s string) error {
	return stringError(s)
}

type stringError string

func (e stringError) Error() string { return string(e) }

// Sanity: the test helper must behave like errors.New so a misuse is
// caught fast rather than producing false negatives.
func TestStringErrorHelper(t *testing.T) {
	var e error = stringError("hello")
	require.True(t, strings.HasPrefix(e.Error(), "hello"))
}
