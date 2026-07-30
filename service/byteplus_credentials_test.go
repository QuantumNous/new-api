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
		"api_key": "ark-video-key",
		"access_key_id": "ak-example",
		"secret_access_key": "sk-example",
		"project_name": "project3"
	}`)
	if err != nil {
		t.Fatalf("ParseBytePlusCredentials structured error: %v", err)
	}
	if creds.APIKey != "ark-video-key" || creds.AccessKeyID != "ak-example" || creds.SecretAccessKey != "sk-example" || creds.ProjectName != "project3" {
		t.Fatalf("parsed credentials = %+v", creds)
	}
	if err := creds.ValidateVideo(); err != nil {
		t.Fatalf("structured key should be valid for video: %v", err)
	}
	if err := creds.ValidateAssets(); err != nil {
		t.Fatalf("structured key should be valid for assets: %v", err)
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
