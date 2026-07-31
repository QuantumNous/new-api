package service

import (
	"strings"
	"testing"
)

func TestParseBytePlusCredentialsAcceptsLegacyKeyForVideoOnly(t *testing.T) {
	creds, err := ParseBytePlusCredentials("ark-legacy-video-key")
	if err != nil {
		t.Fatalf("ParseBytePlusCredentials legacy error: %v", err)
	}
	if creds.APIKey != "ark-legacy-video-key" {
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
}

func TestParseBytePlusCredentialsAcceptsBracketLeadingLegacyKeyForVideoOnly(t *testing.T) {
	creds, err := ParseBytePlusCredentials("[ark-legacy-video-key")
	if err != nil {
		t.Fatalf("ParseBytePlusCredentials bracket-leading legacy error: %v", err)
	}
	if creds.APIKey != "[ark-legacy-video-key" {
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
		"api_key": " ark-video-key ",
		"access_key_id": " ak-example ",
		"secret_access_key": " sk-example ",
		"project_name": " project3 ",
		"real_person_assets": {
			"enabled": true,
			"tos_bucket": " real-person-bucket ",
			"tos_region": " ap-southeast-1 ",
			"tos_internal_endpoint": " https://tos-s3-cn-beijing.volces.com/ "
		}
	}`)
	if err != nil {
		t.Fatalf("ParseBytePlusCredentials structured error: %v", err)
	}
	if creds.APIKey != "ark-video-key" || creds.AccessKeyID != "ak-example" || creds.SecretAccessKey != "sk-example" || creds.ProjectName != "project3" {
		t.Fatalf("parsed credentials = %+v", creds)
	}
	if creds.RealPersonAssets.TOSBucket != "real-person-bucket" || creds.RealPersonAssets.TOSRegion != bytePlusAssetRegion || creds.RealPersonAssets.TOSInternalEndpoint != "https://tos-s3-cn-beijing.volces.com/" {
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
}

func TestBytePlusCredentialsValidateRealPersonAssetsRequiresExplicitEnablement(t *testing.T) {
	creds := BytePlusCredentials{
		APIKey:          "ark-video-key",
		AccessKeyID:     "ak-example",
		SecretAccessKey: "sk-example",
		ProjectName:     "project3",
		RealPersonAssets: BytePlusRealPersonAssetsConfig{
			Enabled:             false,
			TOSBucket:           "real-person-bucket",
			TOSRegion:           bytePlusAssetRegion,
			TOSInternalEndpoint: "https://tos-s3-cn-beijing.volces.com",
		},
	}
	if err := creds.ValidateRealPersonAssets(); err == nil || err.Error() != "byteplus real-person assets are disabled" {
		t.Fatalf("ValidateRealPersonAssets disabled error = %v", err)
	}
}

func TestBytePlusCredentialsValidateRealPersonAssetsRejectsUnsafeEndpoint(t *testing.T) {
	tests := []string{
		"http://tos-s3-cn-beijing.volces.com",
		"https://user:pass@tos-s3-cn-beijing.volces.com",
		"https://tos-s3-cn-beijing.volces.com?token=secret",
		"https://tos-s3-cn-beijing.volces.com#fragment",
		"https://tos-s3-cn-beijing.volces.com/path",
		"tos-s3-cn-beijing.volces.com",
	}
	for _, endpoint := range tests {
		creds := BytePlusCredentials{
			APIKey:          "ark-video-key",
			AccessKeyID:     "ak-example",
			SecretAccessKey: "sk-example",
			ProjectName:     "project3",
			RealPersonAssets: BytePlusRealPersonAssetsConfig{
				Enabled:             true,
				TOSBucket:           "real-person-bucket",
				TOSRegion:           bytePlusAssetRegion,
				TOSInternalEndpoint: endpoint,
			},
		}
		err := creds.ValidateRealPersonAssets()
		if err == nil {
			t.Fatalf("ValidateRealPersonAssets(%q) should fail", endpoint)
		}
		if strings.Contains(err.Error(), endpoint) {
			t.Fatalf("error leaked endpoint %q: %v", endpoint, err)
		}
	}
}

func TestBytePlusCredentialsValidateRealPersonAssetsRequiresModelArkRegion(t *testing.T) {
	creds := BytePlusCredentials{
		APIKey:          "ark-video-key",
		AccessKeyID:     "ak-example",
		SecretAccessKey: "sk-example",
		ProjectName:     "project3",
		RealPersonAssets: BytePlusRealPersonAssetsConfig{
			Enabled:             true,
			TOSBucket:           "real-person-bucket",
			TOSRegion:           "cn-beijing",
			TOSInternalEndpoint: "https://tos-s3-cn-beijing.volces.com",
		},
	}
	if err := creds.ValidateRealPersonAssets(); err == nil {
		t.Fatal("ValidateRealPersonAssets should reject non-ModelArk region")
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
		"api_key": "ark-video-key",
		"access_key_id": "ak-example",
		"secret_access_key": "sk-should-not-leak"
	}`)
	if err != nil {
		t.Fatalf("video parsing should not require asset fields: %v", err)
	}
	err = creds.ValidateAssets()
	if err == nil {
		t.Fatal("ValidateAssets should reject missing project_name")
	}
	if strings.Contains(err.Error(), "sk-should-not-leak") {
		t.Fatalf("error leaked secret: %v", err)
	}
}
