package common

import (
	"strings"
	"testing"
)

func TestRenderRegistrationVerificationEmailBuildsBrandWelcomeLayout(t *testing.T) {
	html, err := RenderRegistrationVerificationEmail(RegistrationVerificationEmail{
		Lang:            "en",
		SystemName:      "Flatkey",
		Heading:         "Welcome to Flatkey",
		Content:         "Confirm your email address to finish creating your account.",
		Action:          "Verify email",
		Alternative:     "Or enter this verification code",
		CodeLabel:       "Verification code",
		Code:            "0b0442",
		Expiry:          "This link and code expire in 10 minutes.",
		IgnoreNotice:    "If you did not request this email, you can safely ignore it.",
		Footer:          "Sent securely by Flatkey",
		VerificationURL: "https://console.flatkey.ai/sign-up/verify#token=abc",
	})
	if err != nil {
		t.Fatalf("render email: %v", err)
	}

	for _, want := range []string{
		"<!doctype html>",
		`<html lang="en">`,
		`name="viewport"`,
		`role="presentation"`,
		"max-width:600px",
		"background:#6d28d9",
		"min-height:48px",
		`target="_blank"`,
		`rel="noopener noreferrer"`,
		"Welcome to Flatkey",
		"Verify email",
		"0b0442",
		"https://console.flatkey.ai/sign-up/verify#token=abc",
	} {
		if !strings.Contains(html, want) {
			t.Errorf("rendered email missing %q", want)
		}
	}

	for _, forbidden := range []string{"<script", "<link", "linear-gradient", "radial-gradient"} {
		if strings.Contains(strings.ToLower(html), forbidden) {
			t.Errorf("rendered email contains forbidden markup %q", forbidden)
		}
	}
}

func TestRenderRegistrationVerificationEmailEscapesDynamicValues(t *testing.T) {
	html, err := RenderRegistrationVerificationEmail(RegistrationVerificationEmail{
		Lang:            `en"><script>alert(1)</script>`,
		SystemName:      `Flat & <Key>`,
		Heading:         `<b>Welcome</b>`,
		Content:         `Confirm & continue`,
		Action:          `Verify "now"`,
		Alternative:     `Or <enter> a code`,
		CodeLabel:       `Code & token`,
		Code:            `<123456>`,
		Expiry:          `Expires <soon>`,
		IgnoreNotice:    `Ignore & delete`,
		Footer:          `Sent by <Flatkey>`,
		VerificationURL: `https://console.example/verify#token=a&next="bad"`,
	})
	if err != nil {
		t.Fatalf("render email: %v", err)
	}

	for _, forbidden := range []string{
		`<script>alert(1)</script>`,
		`<b>Welcome</b>`,
		`<123456>`,
		`href="https://console.example/verify#token=a&next="bad""`,
	} {
		if strings.Contains(html, forbidden) {
			t.Errorf("dynamic value was not escaped: %q", forbidden)
		}
	}
	for _, want := range []string{
		`Flat &amp; &lt;Key&gt;`,
		`&lt;b&gt;Welcome&lt;/b&gt;`,
		`&lt;123456&gt;`,
		`href="https://console.example/verify#token=a&amp;next=`,
	} {
		if !strings.Contains(html, want) {
			t.Errorf("escaped output missing %q", want)
		}
	}
}
