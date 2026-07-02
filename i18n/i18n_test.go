package i18n

import "testing"

func TestParseAcceptLanguageHonorsQualityValues(t *testing.T) {
	tests := []struct {
		name   string
		header string
		want   string
	}{
		{
			name:   "higher q wins over first language",
			header: "zh-CN;q=0.4,en;q=0.9",
			want:   LangEn,
		},
		{
			name:   "traditional chinese can win by q",
			header: "en;q=0.1, zh-TW;q=0.9",
			want:   LangZhTW,
		},
		{
			name:   "unsupported language does not mask lower q supported language",
			header: "fr;q=1.0, zh-CN;q=0.5",
			want:   LangZhCN,
		},
		{
			name:   "zero q is not accepted",
			header: "en;q=0, zh-CN;q=0.8",
			want:   LangZhCN,
		},
		{
			name:   "unsupported languages fall back to default",
			header: "fr;q=1.0, de;q=0.8",
			want:   DefaultLang,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ParseAcceptLanguage(tt.header); got != tt.want {
				t.Fatalf("ParseAcceptLanguage(%q) = %q, want %q", tt.header, got, tt.want)
			}
		})
	}
}
