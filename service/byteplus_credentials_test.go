package service

import (
	"strings"
	"testing"
)

func TestParseBytePlusCredentialsAcceptsLegacyKeyForVideoOnly(t *testing.T) {
	creds, err := ParseBytePlusCredentials("sentinel-legacy-video-key")
	if err != nil {
		t.Fatalf("ParseBytePlusCredentials legacy error: %v", err)
	}
	if creds.APIKey != "sentinel-legacy-video-key" {
		t.Fatalf("APIKey = %q", creds.APIKey)
	}
	if err := creds.ValidateVideo(); err != nil {
		t.Fatalf("legacy key should be valid for video: %v", err)
	}
	if err := creds.ValidateAssets(); err == nil {
		t.Fatal("legacy key should not be valid for asset APIs")
	}
	if err := creds.ValidateRealPersonAssets(); err == nil {
		t.Fatal("legacy key should not be valid for real-person asset APIs")
	}
	if err := creds.ValidateRealPersonAssetStorage(); err == nil {
		t.Fatal("legacy key should not be valid for real-person asset storage")
	}
}

func TestParseBytePlusCredentialsAcceptsBracketLeadingLegacyKeyForVideoOnly(t *testing.T) {
	creds, err := ParseBytePlusCredentials("[sentinel-legacy-video-key")
	if err != nil {
		t.Fatalf("ParseBytePlusCredentials bracket-leading legacy error: %v", err)
	}
	if creds.APIKey != "[sentinel-legacy-video-key" {
		t.Fatalf("APIKey = %q", creds.APIKey)
	}
	if err := creds.ValidateVideo(); err != nil {
		t.Fatalf("bracket-leading legacy key should be valid for video: %v", err)
	}
	if err := creds.ValidateAssets(); err == nil {
		t.Fatal("bracket-leading legacy key should not be valid for asset APIs")
	}
}

func TestParseBytePlusCredentialsAcceptsStructuredJSON(t *testing.T) {
	creds, err := ParseBytePlusCredentials(`{
		"api_key": " sentinel-api-key ",
		"access_key_id": " sentinel-access-key-id ",
		"secret_access_key": " sentinel-secret-key ",
			"project_name": " test-project ",
		"real_person_assets": {
			"enabled": true,
			"tos_bucket": " real-person-bucket ",
			"tos_region": " ap-southeast-1 ",
			"tos_internal_endpoint": " https://tos-ap-southeast-1.ibytepluses.com/ "
		}
	}`)
	if err != nil {
		t.Fatalf("ParseBytePlusCredentials structured error: %v", err)
	}
	if creds.APIKey != "sentinel-api-key" || creds.AccessKeyID != "sentinel-access-key-id" || creds.SecretAccessKey != "sentinel-secret-key" || creds.ProjectName != "test-project" {
		t.Fatalf("parsed credentials = %+v", creds)
	}
	if creds.RealPersonAssets.TOSBucket != "real-person-bucket" || creds.RealPersonAssets.TOSRegion != bytePlusAssetRegion || creds.RealPersonAssets.TOSInternalEndpoint != "https://tos-ap-southeast-1.ibytepluses.com/" {
		t.Fatalf("parsed real-person assets config = %+v", creds.RealPersonAssets)
	}
	if err := creds.ValidateVideo(); err != nil {
		t.Fatalf("structured key should be valid for video: %v", err)
	}
	if err := creds.ValidateAssets(); err != nil {
		t.Fatalf("structured key should be valid for assets: %v", err)
	}
	if err := creds.ValidateRealPersonAssets(); err != nil {
		t.Fatalf("structured key should be valid for real-person assets: %v", err)
	}
	if err := creds.ValidateRealPersonAssetStorage(); err != nil {
		t.Fatalf("structured key should be valid for real-person asset storage: %v", err)
	}
}

func TestBytePlusCredentialsValidateRealPersonAssetsAllowsURLOnlyWithoutTOS(t *testing.T) {
	creds := BytePlusCredentials{
		APIKey:          "sentinel-api-key",
		AccessKeyID:     "sentinel-access-key-id",
		SecretAccessKey: "sentinel-secret-key",
		ProjectName:     "test-project",
		RealPersonAssets: BytePlusRealPersonAssetsConfig{
			Enabled: true,
		},
	}

	if err := creds.ValidateRealPersonAssets(); err != nil {
		t.Fatalf("ValidateRealPersonAssets URL-only error: %v", err)
	}
	if err := creds.ValidateRealPersonAssetStorage(); err == nil || err.Error() != "byteplus real-person tos_bucket is required" {
		t.Fatalf("ValidateRealPersonAssetStorage URL-only error = %v", err)
	}
}

func TestBytePlusCredentialsValidateRealPersonAssetsRequiresExplicitEnablement(t *testing.T) {
	creds := BytePlusCredentials{
		APIKey:          "sentinel-api-key",
		AccessKeyID:     "sentinel-access-key-id",
		SecretAccessKey: "sentinel-secret-key",
		ProjectName:     "test-project",
		RealPersonAssets: BytePlusRealPersonAssetsConfig{
			Enabled:             false,
			TOSBucket:           "real-person-bucket",
			TOSRegion:           bytePlusAssetRegion,
			TOSInternalEndpoint: "https://tos-ap-southeast-1.ibytepluses.com",
		},
	}
	if err := creds.ValidateRealPersonAssets(); err == nil || err.Error() != "byteplus real-person assets are disabled" {
		t.Fatalf("ValidateRealPersonAssets disabled error = %v", err)
	}
}

func TestBytePlusCredentialsValidateRealPersonAssetStorageAllowsOfficialEndpoints(t *testing.T) {
	tests := []string{
		"https://tos-ap-southeast-1.bytepluses.com",
		"https://tos-ap-southeast-1.ibytepluses.com",
		"HTTPS://TOS-AP-SOUTHEAST-1.IBYTEPLUSES.COM:443/",
	}
	for _, endpoint := range tests {
		creds := testBytePlusRealPersonCreds(endpoint)
		if err := creds.ValidateRealPersonAssetStorage(); err != nil {
			t.Fatalf("ValidateRealPersonAssetStorage(%q) error: %v", endpoint, err)
		}
	}
}

func TestBytePlusCredentialsValidateRealPersonAssetStorageRejectsUnsafeEndpoint(t *testing.T) {
	tests := []string{
		"https://tos-s3-cn-beijing.volces.com",
		"https://tos-s3-ap-southeast-1.bytepluses.com",
		"https://tos-s3-ap-southeast-1.ibytepluses.com",
		"https://tos-ap-southeast-1.volces.com",
		"https://tos-ap-southeast-1.ivolces.com",
		"https://attacker.example",
		"http://tos-ap-southeast-1.ibytepluses.com",
		"https://user:pass@tos-ap-southeast-1.ibytepluses.com",
		"https://tos-ap-southeast-1.ibytepluses.com?token=secret",
		"https://tos-ap-southeast-1.ibytepluses.com#fragment",
		"https://tos-ap-southeast-1.ibytepluses.com/path",
		"https://tos-ap-southeast-1.ibytepluses.com/%2F",
		"https://tos-ap-southeast-1.ibytepluses.com:8443",
		"tos-ap-southeast-1.ibytepluses.com",
		"https://10.0.0.1",
		"https://tos-ap-southeast-1.ibytepluses.com.",
		"https:\\tos-ap-southeast-1.ibytepluses.com",
		"https:tos-ap-southeast-1.ibytepluses.com",
	}
	for _, endpoint := range tests {
		creds := testBytePlusRealPersonCreds(endpoint)
		err := creds.ValidateRealPersonAssetStorage()
		if err == nil {
			t.Fatalf("ValidateRealPersonAssetStorage(%q) should fail", endpoint)
		}
		if strings.Contains(err.Error(), endpoint) {
			t.Fatalf("error leaked endpoint %q: %v", endpoint, err)
		}
	}
}

func TestBytePlusCredentialsValidateRealPersonAssetStorageValidatesBucketForTOS(t *testing.T) {
	tests := []struct {
		name    string
		bucket  string
		wantErr bool
	}{
		{name: "too short two", bucket: "ab", wantErr: true},
		{name: "minimum three", bucket: "abc"},
		{name: "maximum sixty three", bucket: strings.Repeat("a", 63)},
		{name: "too long sixty four", bucket: strings.Repeat("a", 64), wantErr: true},
		{name: "uppercase", bucket: "Abucket", wantErr: true},
		{name: "underscore", bucket: "a_bucket", wantErr: true},
		{name: "dot", bucket: "a.bucket", wantErr: true},
		{name: "leading hyphen", bucket: "-bucket", wantErr: true},
		{name: "trailing hyphen", bucket: "bucket-", wantErr: true},
		{name: "middle hyphen", bucket: "real-person-bucket"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			creds := testBytePlusRealPersonCreds("https://tos-ap-southeast-1.ibytepluses.com")
			creds.RealPersonAssets.TOSBucket = tt.bucket
			err := creds.ValidateRealPersonAssetStorage()
			if tt.wantErr && err == nil {
				t.Fatalf("ValidateRealPersonAssetStorage bucket %q should fail", tt.bucket)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("ValidateRealPersonAssetStorage bucket %q error: %v", tt.bucket, err)
			}
			if err != nil && strings.Contains(err.Error(), tt.bucket) {
				t.Fatalf("error leaked bucket %q: %v", tt.bucket, err)
			}
		})
	}
}

func TestBytePlusCredentialsValidateRealPersonAssetStorageRequiresModelArkRegion(t *testing.T) {
	creds := BytePlusCredentials{
		APIKey:          "sentinel-api-key",
		AccessKeyID:     "sentinel-access-key-id",
		SecretAccessKey: "sentinel-secret-key",
		ProjectName:     "test-project",
		RealPersonAssets: BytePlusRealPersonAssetsConfig{
			Enabled:             true,
			TOSBucket:           "real-person-bucket",
			TOSRegion:           "cn-beijing",
			TOSInternalEndpoint: "https://tos-ap-southeast-1.ibytepluses.com",
		},
	}
	if err := creds.ValidateRealPersonAssetStorage(); err == nil {
		t.Fatal("ValidateRealPersonAssetStorage should reject non-ModelArk region")
	}
}

func testBytePlusRealPersonCreds(endpoint string) BytePlusCredentials {
	return BytePlusCredentials{
		APIKey:          "sentinel-api-key",
		AccessKeyID:     "sentinel-access-key-id",
		SecretAccessKey: "sentinel-secret-key",
		ProjectName:     "test-project",
		RealPersonAssets: BytePlusRealPersonAssetsConfig{
			Enabled:             true,
			TOSBucket:           "real-person-bucket",
			TOSRegion:           bytePlusAssetRegion,
			TOSInternalEndpoint: endpoint,
		},
	}
}

func TestParseBytePlusCredentialsRejectsMalformedJSONLookingInput(t *testing.T) {
	_, err := ParseBytePlusCredentials(`{"api_key":`)
	if err == nil {
		t.Fatal("malformed JSON-looking key should fail")
	}
	if strings.Contains(err.Error(), `{"api_key"`) {
		t.Fatalf("error leaked raw key: %v", err)
	}
}

func TestParseBytePlusCredentialsRejectsMissingFieldsWithoutSecretLeak(t *testing.T) {
	creds, err := ParseBytePlusCredentials(`{
		"api_key": "sentinel-api-key",
		"access_key_id": "sentinel-access-key-id",
		"secret_access_key": "sentinel-secret-should-not-leak"
	}`)
	if err != nil {
		t.Fatalf("video parsing should not require asset fields: %v", err)
	}
	err = creds.ValidateAssets()
	if err == nil {
		t.Fatal("ValidateAssets should reject missing project_name")
	}
	if strings.Contains(err.Error(), "sentinel-secret-should-not-leak") {
		t.Fatalf("error leaked secret: %v", err)
	}
}
