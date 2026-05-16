package controller

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestBuildSensitiveScopeGroupOptionsExcludesAutoAndMergesSources(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalGroups := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateGroupRatioByJSONString(originalRatios); err != nil {
			t.Errorf("restore group ratios: %v", err)
		}
		if err := setting.UpdateUserUsableGroupsByJSONString(originalGroups); err != nil {
			t.Errorf("restore user usable groups: %v", err)
		}
	})

	if err := ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2,"internal":1.5,"auto":9}`); err != nil {
		t.Fatalf("UpdateGroupRatioByJSONString returned error: %v", err)
	}
	if err := setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","partner":"Partner","auto":"Auto"}`); err != nil {
		t.Fatalf("UpdateUserUsableGroupsByJSONString returned error: %v", err)
	}

	options := buildSensitiveScopeGroupOptions()
	if len(options) != 4 {
		t.Fatalf("len(options) = %d, want 4", len(options))
	}

	values := make([]string, 0, len(options))
	for _, option := range options {
		values = append(values, option.Value)
		if option.Value == "auto" {
			t.Fatal("group options should not include auto")
		}
		if option.Value == "partner" && option.Ratio != 1 {
			t.Fatalf("partner ratio = %v, want 1", option.Ratio)
		}
		if option.Value == "partner" && option.Desc != "Partner" {
			t.Fatalf("partner desc = %q, want Partner", option.Desc)
		}
	}

	if got := strings.Join(values, ","); got != "default,internal,partner,vip" {
		t.Fatalf("group values = %q, want default,internal,partner,vip", got)
	}
}

func TestParseSensitiveScopeEndpointStringsSupportsArrayAndObject(t *testing.T) {
	arrayEndpoints := parseSensitiveScopeEndpointStrings(
		`["openai","openai-response-compact"]`,
	)
	if got := strings.Join(arrayEndpoints, ","); got != "openai,openai-response-compact" {
		t.Fatalf("array endpoints = %q, want openai,openai-response-compact", got)
	}

	objectEndpoints := parseSensitiveScopeEndpointStrings(
		`{"openai":{"path":"/v1/chat/completions"},"gemini":{"path":"/v1beta/models/{model}:generateContent"}}`,
	)
	if got := strings.Join(objectEndpoints, ","); got != "gemini,openai" {
		t.Fatalf("object endpoints = %q, want gemini,openai", got)
	}

	invalidEndpoints := parseSensitiveScopeEndpointStrings(`{"openai":}`)
	if len(invalidEndpoints) != 0 {
		t.Fatalf("invalid endpoints = %#v, want empty slice", invalidEndpoints)
	}
}
