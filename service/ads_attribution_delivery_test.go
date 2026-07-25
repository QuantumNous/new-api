package service

import "testing"

func TestAdsAttributionDeliveryEndpointSeparatesFunnelEvents(t *testing.T) {
	config := adsAttributionDeliveryConfig{
		BaseURL: "https://app.11agents.ai", TenantID: "tenant-1", Project: "flatkey", Token: "secret",
	}
	cases := map[string]string{
		"signup":     "/signup",
		"activation": "/activation",
		"purchase":   "/revenue",
		"refund":     "/revenue",
	}
	for eventType, suffix := range cases {
		endpoint, err := config.endpoint(eventType)
		if err != nil {
			t.Fatalf("%s endpoint failed: %v", eventType, err)
		}
		if endpoint[len(endpoint)-len(suffix):] != suffix {
			t.Fatalf("%s endpoint %q does not end in %q", eventType, endpoint, suffix)
		}
	}
	if _, err := config.endpoint("registration-as-purchase"); err == nil {
		t.Fatal("unknown funnel event must be rejected")
	}
}
