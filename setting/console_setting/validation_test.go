package console_setting

import "testing"

func TestValidateApiKeyUsageTips(t *testing.T) {
	valid := `{
		"sections": [
			{
				"id": "codex",
				"name": "Codex",
				"platforms": [
					{
						"id": "windows",
						"name": "Windows",
						"files": [
							{
								"path": "%userprofile%\\.codex\\config.toml",
								"language": "toml",
								"content": "base_url = \"{{baseUrl}}\""
							},
							{
								"path": "%userprofile%\\.codex\\auth.json",
								"language": "json",
								"content": "{\"OPENAI_API_KEY\":\"{{apiKey}}\"}"
							}
						]
					}
				]
			}
		]
	}`

	if err := ValidateConsoleSettings(valid, "ApiKeyUsageTips"); err != nil {
		t.Fatalf("expected valid API KEY usage tips, got error: %v", err)
	}
}

func TestValidateApiKeyUsageTipsRejectsMissingFiles(t *testing.T) {
	invalid := `{
		"sections": [
			{
				"id": "codex",
				"name": "Codex"
			}
		]
	}`

	if err := ValidateConsoleSettings(invalid, "ApiKeyUsageTips"); err == nil {
		t.Fatal("expected missing files to be rejected")
	}
}
