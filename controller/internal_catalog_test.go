package controller

import (
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/kids"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// TestGetRouterCatalog_InputValidation covers the request-parsing paths that
// don't touch the DB. The DB-backed paths (tenant lookup, abilities join,
// pricing pull) are covered end-to-end by docker-compose smoke
// (commit b02776f6 in deeprouter; manual probe documented in smart-router
// docs/PRD.md Phase 2 status).
func TestGetRouterCatalog_InputValidation(t *testing.T) {
	r := gin.New()
	r.GET("/internal/router-catalog", GetRouterCatalog)

	// Only the no-DB paths are exercised here. Anything past
	// strconv.Atoi hits model.GetUserById which needs a live gorm.DB
	// (covered by docker-compose smoke).
	cases := []struct {
		name        string
		queryString string
		wantStatus  int
		wantSubstr  string
	}{
		{"missing tenant_id", "", http.StatusBadRequest, "missing_tenant_id"},
		{"empty tenant_id", "?tenant_id=", http.StatusBadRequest, "missing_tenant_id"},
		{"non-numeric tenant_id", "?tenant_id=abc", http.StatusBadRequest, "invalid_tenant_id"},
		{"floating-point tenant_id", "?tenant_id=1.5", http.StatusBadRequest, "invalid_tenant_id"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/internal/router-catalog"+tc.queryString, nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d (body=%s)", w.Code, tc.wantStatus, w.Body.String())
			}
			if tc.wantSubstr != "" && !contains(w.Body.String(), tc.wantSubstr) {
				t.Errorf("body=%q does not contain %q", w.Body.String(), tc.wantSubstr)
			}
		})
	}
}

func contains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// TestChannelTypeToBrand_KnownEntries locks the brand mapping for the channel
// types we currently route through. Adding a new channel type without
// updating this map would silently make smart-router's allowed_brands
// constraint useless for that brand.
func TestChannelTypeToBrand_KnownEntries(t *testing.T) {
	for chanType, wantBrand := range channelTypeToBrand {
		if wantBrand == "" {
			t.Errorf("channel type %d maps to empty brand", chanType)
		}
	}
	if len(channelTypeToBrand) < 5 {
		t.Errorf("brand map suspiciously small: %d entries", len(channelTypeToBrand))
	}
}

// TestKidsModeCatalogPreFilter pins the design contract that the catalog
// endpoint pre-filters models on the kids-safe whitelist for kids_mode
// tenants. The actual filtering happens inside GetRouterCatalog and is
// covered end-to-end by docker-compose smoke. This test just locks the
// whitelist itself so adding a new V0 model can't accidentally bypass the
// "kid-safe by name" check by being named in a way the prefix matcher
// confuses for a safe model.
func TestKidsModeCatalogPreFilter(t *testing.T) {
	allow := []string{
		"gpt-4o-mini",
		"gpt-4o",
		"claude-3-5-haiku",
		"claude-3-5-haiku-20241022", // versioned variant — prefix match
		"claude-3-5-sonnet",
	}
	deny := []string{
		"claude-3-opus-latest", // opus NOT in whitelist
		"gpt-4-turbo",          // base 4-turbo NOT in whitelist
		"o1-mini",              // reasoning models NOT in whitelist
		"deepseek-chat",        // deepseek NOT in whitelist (no audit yet)
		"gemini-1.5-pro",       // gemini NOT in whitelist
		"",
	}
	for _, m := range allow {
		if !kids.IsModelEligible(m) {
			t.Errorf("expected %q to be kids-eligible", m)
		}
	}
	for _, m := range deny {
		if kids.IsModelEligible(m) {
			t.Errorf("expected %q to be NOT kids-eligible", m)
		}
	}
}

// TestModelRatioConversion locks the conversion factor between DeepRouter's
// internal model_ratio units and smart-router's per-1M-USD schema. Numbers
// come from authoritative comments in setting/ratio_setting/model_ratio.go.
//
// If this test breaks, it means either:
//   - upstream changed the meaning of model_ratio (audit setting/ratio_setting/),
//   - or someone changed modelRatioToPerMillionUSD without updating these
//     ground-truth values.
//
// Smart-router's cost-constraint filters depend on this conversion being
// correct; an off-by-500× bug silently invalidates every cost-based decision.
func TestModelRatioConversion(t *testing.T) {
	cases := []struct {
		ratio   float64
		want1M  float64
		comment string
	}{
		{1.0, 2.0, "$0.002/1k = $2/1M"},
		{1.25, 2.5, "gpt-4o → $2.5/1M"},
		{2.5, 5.0, "chatgpt-4o-latest → $5/1M"},
		{5.0, 10.0, "gpt-4-1106-preview → $10/1M"},
		{15.0, 30.0, "gpt-4 → $30/1M"},
		{0.075, 0.15, "haiku-class → $0.15/1M"},
	}
	for _, tc := range cases {
		got := tc.ratio * modelRatioToPerMillionUSD
		if math.Abs(got-tc.want1M) > 0.0001 {
			t.Errorf("ratio %g (%s): got $%g/1M want $%g/1M", tc.ratio, tc.comment, got, tc.want1M)
		}
	}
}

// TestGetModelRatio_KnownDefaults verifies that defaults shipped in
// setting/ratio_setting/model_ratio.go match the inline comments. Stops
// silent drift if upstream changes a ratio without updating the comment.
func TestGetModelRatio_KnownDefaults(t *testing.T) {
	cases := []struct {
		model        string
		wantPer1MUSD float64
		comment      string
	}{
		{"gpt-4o", 2.5, "$2.5/1M"},
		{"gpt-4", 30.0, "$30/1M"},
	}
	defaults := ratio_setting.GetDefaultModelRatioMap()
	for _, tc := range cases {
		ratio, ok := defaults[tc.model]
		if !ok {
			t.Errorf("upstream removed %s from defaultModelRatio", tc.model)
			continue
		}
		got := ratio * modelRatioToPerMillionUSD
		if math.Abs(got-tc.wantPer1MUSD) > 0.0001 {
			t.Errorf("%s: ratio %g → $%g/1M, expected $%g/1M (%s)",
				tc.model, ratio, got, tc.wantPer1MUSD, tc.comment)
		}
	}
}
