package protocol

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupCollectedClientData(challenge URLEncodedBase64, origin, topOrigin string, crossOrigin bool) *CollectedClientData { //nolint:unparam
	ccd := &CollectedClientData{
		Type:        CreateCeremony,
		Origin:      origin,
		TopOrigin:   topOrigin,
		CrossOrigin: crossOrigin,
		Challenge:   challenge.String(),
	}

	return ccd
}

func TestVerifyCollectedClientData(t *testing.T) {
	newChallenge, err := CreateChallenge()
	require.NoError(t, err)

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example.com", true)

	var storedChallenge = newChallenge

	require.NoError(t, ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.Origin}, []string{ccd.TopOrigin}, TopOriginExplicitVerificationMode))
}

func TestVerifyCollectedClientDataNoTopOrigin(t *testing.T) {
	newChallenge, err := CreateChallenge()
	require.NoError(t, err)

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "", true)

	var storedChallenge = newChallenge

	require.NoError(t, ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.Origin}, []string{ccd.TopOrigin}, TopOriginExplicitVerificationMode))
}

func TestVerifyCollectedClientDataTopOrigin(t *testing.T) {
	newChallenge, err := CreateChallenge()
	require.NoError(t, err)

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example2.com", true)

	var storedChallenge = newChallenge

	require.NoError(t, ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.Origin}, []string{ccd.TopOrigin}, TopOriginExplicitVerificationMode))
}

func TestVerifyCollectedClientDataTopOriginIgnore(t *testing.T) {
	newChallenge, err := CreateChallenge()
	require.NoError(t, err)

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example2.com", true)

	var storedChallenge = newChallenge

	require.NoError(t, ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.Origin}, []string{"https://example3.com"}, TopOriginIgnoreVerificationMode))
}

func TestVerifyCollectedClientDataTopOriginImplicit(t *testing.T) {
	newChallenge, err := CreateChallenge()
	require.NoError(t, err)

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example.com", true)

	var storedChallenge = newChallenge

	require.NoError(t, ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.Origin}, nil, TopOriginImplicitVerificationMode))
}

func TestVerifyCollectedClientDataTopOriginAuto(t *testing.T) {
	newChallenge, err := CreateChallenge()
	require.NoError(t, err)

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example.com", true)

	var storedChallenge = newChallenge

	require.NoError(t, ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.Origin}, []string{"https://example.com"}, TopOriginAutoVerificationMode))
}

func TestVerifyCollectedClientDataTopOriginInvalidValue(t *testing.T) {
	newChallenge, err := CreateChallenge()
	require.NoError(t, err)

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example.com", true)

	var storedChallenge = newChallenge

	AssertIsProtocolError(t, ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.Origin}, []string{"https://example.com"}, -1), "not_implemented", "Error handling unknown Top Origin verification mode", "")
}

func TestVerifyCollectedClientDataIncorrectChallenge(t *testing.T) {
	newChallenge, err := CreateChallenge()
	if err != nil {
		t.Fatalf("error creating challenge: %s", err)
	}

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example.com", true)

	bogusChallenge, err := CreateChallenge()
	require.NoError(t, err)

	AssertIsProtocolError(t, ccd.Verify(bogusChallenge.String(), ccd.Type, []string{ccd.Origin}, []string{ccd.TopOrigin}, TopOriginExplicitVerificationMode), "verification_error", "Error validating challenge", fmt.Sprintf("Expected b Value: \"%s\"\nReceived b: \"%s\"\n", bogusChallenge.String(), newChallenge.String()))
}

func TestVerifyCollectedClientDataUnexpectedOrigin(t *testing.T) {
	newChallenge, err := CreateChallenge()
	if err != nil {
		t.Fatalf("error creating challenge: %s", err)
	}

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example.com", true)
	storedChallenge := newChallenge
	expectedOrigins := []string{"http://different.com"}

	AssertIsProtocolError(t, ccd.Verify(storedChallenge.String(), ccd.Type, expectedOrigins, nil, TopOriginExplicitVerificationMode), "verification_error", "Error validating origin", "Expected Values: [http://different.com], Received: http://example.com")
}

func TestVerifyCollectedClientDataUnexpectedTopOriginCrossOrigin(t *testing.T) {
	newChallenge, err := CreateChallenge()
	if err != nil {
		t.Fatalf("error creating challenge: %s", err)
	}

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example2.com", false)
	storedChallenge := newChallenge

	AssertIsProtocolError(t, ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.Origin}, []string{ccd.TopOrigin}, TopOriginExplicitVerificationMode), "verification_error", "Error validating topOrigin", "The topOrigin can't have values unless crossOrigin is true.")
}

func TestVerifyCollectedClientDataUnexpectedTopOrigin(t *testing.T) {
	newChallenge, err := CreateChallenge()
	if err != nil {
		t.Fatalf("error creating challenge: %s", err)
	}

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example.com", true)
	storedChallenge := newChallenge
	expectedOrigins := []string{"http://different.com"}

	if err = ccd.Verify(storedChallenge.String(), ccd.Type, []string{ccd.TopOrigin}, expectedOrigins, TopOriginExplicitVerificationMode); err == nil {
		t.Fatalf("error expected but not received. expected %#v got %#v", expectedOrigins, ccd.Origin)
	}
}

func TestVerifyCollectedClientDataWithMultipleExpectedOrigins(t *testing.T) {
	newChallenge, err := CreateChallenge()
	if err != nil {
		t.Fatalf("error creating challenge: %s", err)
	}

	ccd := setupCollectedClientData(newChallenge, "http://example.com", "http://example.com", true)

	var storedChallenge = newChallenge

	expectedOrigins := []string{"https://exmaple.com", "9C:B4:AE:EF:05:53:6E:73:0E:C4:B8:02:E7:67:F6:7D:A4:E7:BC:26:D7:42:B5:27:FF:01:7D:68:2A:EB:FA:1D", ccd.Origin}

	if err = ccd.Verify(storedChallenge.String(), ccd.Type, expectedOrigins, nil, TopOriginIgnoreVerificationMode); err != nil {
		t.Fatalf("error verifying challenge: expected %#v got %#v", expectedOrigins, ccd.Origin)
	}
}

func TestFullyQualifiedOrigin(t *testing.T) {
	testCases := []struct {
		name                  string
		have                  string
		expected, expectedErr string
	}{
		{"ShouldParse", "https://app.example.com", "https://app.example.com", ``},
		{"ShouldParseWithPath", "https://app.example.com/apath", "https://app.example.com", ``},
		{"ShouldParseWithPort", "https://app.example.com:8443/apath", "https://app.example.com:8443", ``},
		{"ShouldParseWithCredentials", "https://user:password@app.example.com/", "https://app.example.com", ``},
		{"ShouldParseWithQuery", "https://app.example.com/?abc=123", "https://app.example.com", ``},
		{"ShouldParseWithFragment", "https://app.example.com/#abc", "https://app.example.com", ``},
		{"ShouldSkipParsingAndroidNative", "android:apk-key-hash:7d1043473d55bfa90e8530d35801d4e381bc69f0", "android:apk-key-hash:7d1043473d55bfa90e8530d35801d4e381bc69f0", ""},
		{"ShouldFailToParseMissingScheme", "app.example.com/apath", "", `parse "app.example.com/apath": invalid URI for request`},
		{"ShouldFailToParseBlankScheme", "://app.example.com/apath", "", `parse "://app.example.com/apath": missing protocol scheme`},
		{"ShouldFailToParseMissingHost", "https:///apath", "", `url 'https:///apath' does not have a host`},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual, actualErr := FullyQualifiedOrigin(tc.have)

			assert.Equal(t, tc.expected, actual)

			if tc.expectedErr == "" {
				assert.NoError(t, actualErr)
			} else {
				assert.EqualError(t, actualErr, tc.expectedErr)
			}
		})
	}
}

func TestIsOriginInHaystack(t *testing.T) {
	testCases := []struct {
		name     string
		origin   string
		haystack []string
		expected bool
	}{
		{
			"ShouldHandleFullyQualifiedOrigin",
			"https://app.example.com",
			[]string{"https://app.example.com"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginCaseInsensitiveScheme",
			"https://app.example.com",
			[]string{"HTTPS://app.example.com"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginCaseInsensitiveHost",
			"https://app.EXAMPLE.com",
			[]string{"https://app.example.com"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginWithPort",
			"https://app.example.com:443",
			[]string{"https://app.example.com:443"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginDifferentScheme",
			"http://app.example.com",
			[]string{"https://app.example.com"},
			false,
		},
		{
			"ShouldHandleFullyQualifiedOriginDifferentPort",
			"https://app.example.com:443",
			[]string{"https://app.example.com"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginDifferentPortNotMatchingScheme",
			"https://app.example.com:80",
			[]string{"https://app.example.com"},
			false,
		},
		{
			"ShouldHandleFullyQualifiedOriginDifferentPath",
			"https://app.example.com/abc",
			[]string{"https://app.example.com"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginDifferentQuery",
			"https://app.example.com/?abc=123",
			[]string{"https://app.example.com"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginDifferentQueryCount",
			"https://app.example.com/?abc=123",
			[]string{"https://app.example.com/?zyz=123&abc=123"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginDifferentQueryOrder",
			"https://app.example.com/?abc=123&xyz=123",
			[]string{"https://app.example.com/?xyz=123&abc=123"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginDifferentQueryValue",
			"https://app.example.com/?abc=123&xyz=123",
			[]string{"https://app.example.com/?xyz=1234&abc=123"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginFragment",
			"https://app.example.com/#abc",
			[]string{"https://app.example.com/#abc"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginFragmentDifferent",
			"https://app.example.com/#abc",
			[]string{"https://app.example.com/#abc2"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginWithoutAllowed",
			"https://app.example.com",
			nil,
			false,
		},
		{
			"ShouldHandleFullyQualifiedOriginWithTrailingSlashes",
			"https://app.example.com/",
			[]string{"https://app.example.com"},
			true,
		},
		{
			"ShouldHandleNativeAppAndroid",
			"android:apk-key-hash:7d1043473d55bfa90e8530d35801d4e381bc69f0",
			[]string{"android:apk-key-hash:7d1043473d55bfa90e8530d35801d4e381bc69f0"},
			true,
		},
		{
			"ShouldHandleNativeAppAndroidCaseSensitive",
			"android:apk-key-hash:7d1043473d55bfa90e8530d35801d4e381bc69F0",
			[]string{"android:apk-key-hash:7d1043473d55bfa90e8530d35801d4e381bc69f0"},
			false,
		},
		{
			"ShouldHandleNonFQDNOrigin",
			"https://user:password@app.example.com/",
			[]string{"https://app.example.com/"},
			true,
		},
		{
			"ShouldHandleNonFQDNOriginExactStringMatch",
			"https://user:password@app.example.com/",
			[]string{"https://user:password@app.example.com/"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginDefaultPortEquivalentHTTPS",
			"https://app.example.com:443",
			[]string{"https://app.example.com"},
			true,
		},
		{
			"ShouldHandleFullyQualifiedOriginDefaultPortEquivalentHTTP",
			"http://app.example.com:80",
			[]string{"http://app.example.com"},
			true,
		},
		{
			"ShouldHandleInvalidURLAsSimpleStringMatch",
			"http://app.example.%%%&123?1",
			[]string{"http://app.example.%%%&123?1"},
			true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, IsOriginInHaystack(tc.origin, tc.haystack))
		})
	}
}
