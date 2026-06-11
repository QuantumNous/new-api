package console_setting

import "testing"

func TestValidateAnnouncementsForcePopup(t *testing.T) {
	settings := `[
		{
			"content": "default force popup omitted",
			"publishDate": "2026-06-10T12:00:00+08:00",
			"type": "default"
		},
		{
			"content": "force popup enabled",
			"publishDate": "2026-06-10T12:00:00+08:00",
			"type": "warning",
			"forcePopup": true
		},
		{
			"content": "force popup disabled",
			"publishDate": "2026-06-10T12:00:00+08:00",
			"type": "success",
			"forcePopup": false
		}
	]`

	if err := ValidateConsoleSettings(settings, "Announcements"); err != nil {
		t.Fatalf("expected forcePopup boolean values to validate, got %v", err)
	}
}

func TestValidateAnnouncementsRejectsInvalidForcePopup(t *testing.T) {
	tests := []struct {
		name     string
		settings string
	}{
		{
			name: "string",
			settings: `[
				{
					"content": "invalid string force popup",
					"publishDate": "2026-06-10T12:00:00+08:00",
					"type": "warning",
					"forcePopup": "true"
				}
			]`,
		},
		{
			name: "number",
			settings: `[
				{
					"content": "invalid numeric force popup",
					"publishDate": "2026-06-10T12:00:00+08:00",
					"type": "warning",
					"forcePopup": 1
				}
			]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateConsoleSettings(tt.settings, "Announcements"); err == nil {
				t.Fatal("expected invalid forcePopup value to fail validation")
			}
		})
	}
}
