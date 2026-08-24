package model

import (
	"reflect"
	"testing"
)

// TestUser_AirbotixFieldsPresent guards against accidental upstream merge
// removing our Airbotix-specific fields from the User struct.
// See AIRBOTIX.md for context.
func TestUser_AirbotixFieldsPresent(t *testing.T) {
	required := []string{
		// Phase 1 tenant fields
		"KidsMode",
		"PolicyProfile",
		"BillingWebhookURL",
		"CustomPricingID",
		"WebhookSecret",
		// Auto top-up (Stripe off-session)
		"AutoTopupEnabled",
		"AutoTopupThreshold",
		"AutoTopupAmount",
		// Skill creator marketplace (Module3 P1)
		"CreatorInvitedAt",
	}

	rt := reflect.TypeOf(User{})
	for _, name := range required {
		if _, ok := rt.FieldByName(name); !ok {
			t.Errorf("User struct missing required Airbotix field %q "+
				"— do not remove. See model/user.go and AIRBOTIX.md.", name)
		}
	}
}

// TestUser_AirbotixFieldDefaults asserts the zero-value semantics we rely on
// (passthrough behaviour for any tenant that hasn't been explicitly configured).
func TestUser_AirbotixFieldDefaults(t *testing.T) {
	u := User{}
	if u.KidsMode != false {
		t.Errorf("KidsMode zero value must be false, got %v", u.KidsMode)
	}
	if u.PolicyProfile != "" {
		t.Errorf("PolicyProfile zero value must be empty string (defaults to passthrough at policy layer), got %q", u.PolicyProfile)
	}
}

// TestUser_AirbotixFieldsRoundTrip verifies struct fields accept and preserve
// expected values (compile-time + runtime sanity check).
func TestUser_AirbotixFieldsRoundTrip(t *testing.T) {
	u := User{
		KidsMode:           true,
		PolicyProfile:      "kid-safe",
		BillingWebhookURL:  "https://api.kidsinai.org/internal/deeprouter/billing",
		CustomPricingID:    "pricing_kids_v1",
		WebhookSecret:      "t0p_s3cret_hmac",
		AutoTopupEnabled:   true,
		AutoTopupThreshold: 100000,
		AutoTopupAmount:    5000000,
	}

	if !u.KidsMode {
		t.Errorf("KidsMode set to true should remain true")
	}
	if u.PolicyProfile != "kid-safe" {
		t.Errorf("PolicyProfile mismatch, want kid-safe got %q", u.PolicyProfile)
	}
	if u.BillingWebhookURL != "https://api.kidsinai.org/internal/deeprouter/billing" {
		t.Errorf("BillingWebhookURL mismatch")
	}
	if u.CustomPricingID != "pricing_kids_v1" {
		t.Errorf("CustomPricingID mismatch")
	}
	if u.WebhookSecret != "t0p_s3cret_hmac" {
		t.Errorf("WebhookSecret mismatch")
	}
	if !u.AutoTopupEnabled {
		t.Errorf("AutoTopupEnabled should remain true")
	}
	if u.AutoTopupThreshold != 100000 {
		t.Errorf("AutoTopupThreshold mismatch, want 100000 got %d", u.AutoTopupThreshold)
	}
	if u.AutoTopupAmount != 5000000 {
		t.Errorf("AutoTopupAmount mismatch, want 5000000 got %d", u.AutoTopupAmount)
	}
}
