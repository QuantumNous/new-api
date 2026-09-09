package common

import "testing"

func TestIsGeminiCountTokensPath(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/v1beta/models/gemini-2.5-pro:countTokens", true},
		{"/v1beta/models/gemini-2.5-pro:countTokens/", true},
		{"/v1beta/models/gemini-2.5-pro:generateContent", false},
		{"/v1beta/models/gemini-2.5-pro:streamGenerateContent", false},
		{"/v1beta/models/gemini-embedding-2:embedContent", false},
		// 模型名里含 countTokens 时不能被误判为计数请求，
		// 否则会走计数处理器并跳过生成计费。
		{"/v1beta/models/my-countTokens-model:generateContent", false},
		{"/v1beta/models/countTokens:generateContent", false},
		{"", false},
	}
	for _, c := range cases {
		if got := IsGeminiCountTokensPath(c.path); got != c.want {
			t.Errorf("IsGeminiCountTokensPath(%q) = %v, want %v", c.path, got, c.want)
		}
	}
}
