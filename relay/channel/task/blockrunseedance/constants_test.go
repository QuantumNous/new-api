package blockrunseedance

import "testing"

// FIX #1: an operator-configured model mapping may target the wire name
// (bytedance/seedance-2.0) directly; upstreamModel must resolve it to itself
// (identity) instead of failing the lookup and burning the request.
func TestUpstreamModel_IdentityWireNames(t *testing.T) {
	cases := map[string]string{
		"seedance-2.0":              "bytedance/seedance-2.0",
		"seedance-2.0-fast":         "bytedance/seedance-2.0-fast",
		"seedance-1.5-pro":          "bytedance/seedance-1.5-pro",
		"bytedance/seedance-2.0":    "bytedance/seedance-2.0",
		"bytedance/seedance-2.0-fast": "bytedance/seedance-2.0-fast",
		"bytedance/seedance-1.5-pro":  "bytedance/seedance-1.5-pro",
	}
	for in, want := range cases {
		got, ok := upstreamModel(in)
		if !ok {
			t.Fatalf("upstreamModel(%q) ok=false, want true", in)
		}
		if got != want {
			t.Fatalf("upstreamModel(%q)=%q, want %q", in, got, want)
		}
	}
}

// FIX #1: supportsRealFaceAsset must accept the wire names too so a mapping that
// targets the upstream id keeps the 2.0 / 2.0-fast asset capability.
func TestSupportsRealFaceAsset_WireNames(t *testing.T) {
	yes := []string{
		"seedance-2.0", "seedance-2.0-fast",
		"bytedance/seedance-2.0", "bytedance/seedance-2.0-fast",
	}
	for _, m := range yes {
		if !supportsRealFaceAsset(m) {
			t.Fatalf("supportsRealFaceAsset(%q)=false, want true", m)
		}
	}
	no := []string{"seedance-1.5-pro", "bytedance/seedance-1.5-pro", "other"}
	for _, m := range no {
		if supportsRealFaceAsset(m) {
			t.Fatalf("supportsRealFaceAsset(%q)=true, want false", m)
		}
	}
}

// Production verification observed the async video gateway advertising a 600s
// x402 authorization window. The video window cap MUST cover it, or every video
// submit is refused before signing (the 300s chat cap rejected it in prod).
func TestVideoAuthorizationWindowCoversUpstream(t *testing.T) {
	const observedUpstreamWindow = 600
	if maxAuthorizationWindowSecondsVideo < observedUpstreamWindow {
		t.Fatalf("video window cap %ds is below the observed upstream window %ds",
			maxAuthorizationWindowSecondsVideo, observedUpstreamWindow)
	}
}
