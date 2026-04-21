package common

import (
	"strings"
	"testing"
)

func TestMaskSensitiveInfoMasksUpstreamCredentials(t *testing.T) {
	secretKey := "sk-upstream-secret-1234567890"
	googleKey := "AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70"
	jwtToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sTJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7Hg"
	input := strings.Join([]string{
		"Authorization: Bearer " + secretKey,
		`"x-goog-api-key":"` + googleKey + `"`,
		"https://generativelanguage.googleapis.com/v1/files/abc?key=" + googleKey,
		"token=" + jwtToken,
	}, "\n")

	masked := MaskSensitiveInfo(input)

	if strings.Contains(masked, secretKey) {
		t.Fatalf("masked output still contains OpenAI-style key: %s", masked)
	}
	if strings.Contains(masked, googleKey) {
		t.Fatalf("masked output still contains Google key: %s", masked)
	}
	if strings.Contains(masked, jwtToken) {
		t.Fatalf("masked output still contains JWT token: %s", masked)
	}
	if !strings.Contains(masked, "Authorization: Bearer ***") {
		t.Fatalf("authorization bearer token was not masked as expected: %s", masked)
	}
	if !strings.Contains(masked, "key=***") {
		t.Fatalf("URL query key was not masked as expected: %s", masked)
	}
}
