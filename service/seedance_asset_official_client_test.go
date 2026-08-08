package service

import (
	"net/http"
	"testing"
)

func TestParseSeedanceOfficialKey(t *testing.T) {
	ak, sk, region, err := parseSeedanceOfficialKey("AK123|SK456", seedanceOfficialCNRegion)
	if err != nil {
		t.Fatal(err)
	}
	if ak != "AK123" || sk != "SK456" || region != "cn-beijing" {
		t.Fatalf("got %s %s %s", ak, sk, region)
	}

	ak, sk, region, err = parseSeedanceOfficialKey("AK|SK", seedanceOfficialOverseasRegion)
	if err != nil {
		t.Fatal(err)
	}
	if region != "ap-southeast-1" {
		t.Fatalf("overseas default region=%s", region)
	}

	ak, sk, region, err = parseSeedanceOfficialKey("AK|SK|cn-shanghai", seedanceOfficialOverseasRegion)
	if err != nil {
		t.Fatal(err)
	}
	if region != "cn-shanghai" {
		t.Fatalf("region override=%s", region)
	}

	if _, _, _, err := parseSeedanceOfficialKey("only-sk", ""); err == nil {
		t.Fatal("expected error for invalid key")
	}
	if _, _, _, err := parseSeedanceOfficialKey("|SK", ""); err == nil {
		t.Fatal("expected error for empty AK")
	}
	if _, _, _, err := parseSeedanceOfficialKey("sk-test|secret", ""); err == nil {
		t.Fatal("expected error for API key mistaken as AK")
	}
	ak, sk, region, err = parseSeedanceOfficialKey("AKLT1\nSKSECRET\nap-southeast-1", seedanceOfficialCNRegion)
	if err != nil || ak != "AKLT1" || sk != "SKSECRET" || region != "ap-southeast-1" {
		t.Fatalf("newline key parse got %s %s %s err=%v", ak, sk, region, err)
	}
}

func TestSeedanceOfficialEndpointForPlatform(t *testing.T) {
	cn := seedanceOfficialEndpointForPlatform("cn")
	if cn.Host != seedanceOfficialCNHost || cn.Region != seedanceOfficialCNRegion {
		t.Fatalf("cn profile: %+v", cn)
	}
	ov := seedanceOfficialEndpointForPlatform("overseas")
	if ov.Host != seedanceOfficialOverseasHost || ov.Region != seedanceOfficialOverseasRegion {
		t.Fatalf("overseas profile: %+v", ov)
	}
	ov2 := seedanceOfficialEndpointForPlatform("byteplus")
	if ov2.Host != seedanceOfficialOverseasHost {
		t.Fatalf("byteplus alias: %+v", ov2)
	}
}

func TestIsSeedanceOfficialAllowedHost(t *testing.T) {
	if !isSeedanceOfficialAllowedHost("ark.ap-southeast-1.byteplusapi.com") {
		t.Fatal("byteplus host should be allowed")
	}
	if !isSeedanceOfficialAllowedHost("ark.cn-beijing.volcengineapi.com") {
		t.Fatal("volc host should be allowed")
	}
	if isSeedanceOfficialAllowedHost("api.openai.com") {
		t.Fatal("openai host must be rejected")
	}
	if isSeedanceOfficialAllowedHost("996k.cn") {
		t.Fatal("unrelated host must be rejected")
	}
}

func TestOfficialUpstreamErrorValidatePending(t *testing.T) {
	raw := map[string]any{
		"ResponseMetadata": map[string]any{
			"Error": map[string]any{
				"Code":    "ValidatePending",
				"Message": "pending",
			},
		},
	}
	err := officialUpstreamError(http.StatusOK, raw, nil, true, &seedanceOfficialGateway{Platform: "overseas", Host: seedanceOfficialOverseasHost}, "GetVisualValidateResult")
	se, ok := err.(*SeedanceAssetError)
	if !ok {
		t.Fatalf("expected SeedanceAssetError, got %T", err)
	}
	if se.Status != http.StatusNotFound || se.Code != "group_not_found" {
		t.Fatalf("unexpected: %+v", se)
	}
}

func TestToFromOfficialAssetType(t *testing.T) {
	if toOfficialAssetType("video") != "Video" {
		t.Fatal(toOfficialAssetType("video"))
	}
	if fromOfficialAssetType("Audio") != "audio" {
		t.Fatal(fromOfficialAssetType("Audio"))
	}
	if fromOfficialStatus("Active") != "active" {
		t.Fatal(fromOfficialStatus("Active"))
	}
}
