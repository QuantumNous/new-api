package operation_setting

import "testing"

func TestIsCountryBlocked(t *testing.T) {
	// 保存原始值，测试后恢复
	original := geoBlockSetting
	defer func() { geoBlockSetting = original }()

	tests := []struct {
		name      string
		enabled   bool
		countries string
		country   string
		want      bool
	}{
		{"disabled returns false", false, "CN,RU", "CN", false},
		{"empty country returns false", true, "CN,RU", "", false},
		{"empty countries list returns false", true, "", "CN", false},
		{"exact match", true, "CN,RU,IR", "CN", true},
		{"case insensitive", true, "cn,ru", "CN", true},
		{"not in list", true, "CN,RU", "US", false},
		{"with spaces", true, " CN , RU , IR ", "RU", true},
		{"single country match", true, "CN", "CN", true},
		{"single country no match", true, "CN", "US", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			geoBlockSetting.Enabled = tt.enabled
			geoBlockSetting.Countries = tt.countries
			got := IsCountryBlocked(tt.country)
			if got != tt.want {
				t.Errorf("IsCountryBlocked(%q) = %v, want %v", tt.country, got, tt.want)
			}
		})
	}
}
