package service

import "testing"

func TestCollectTranslationRefs_TranslatesValuesAndMapKeys(t *testing.T) {
	root := map[string]any{
		"data": map[string]any{
			"默认分组": map[string]any{
				"desc": "用户分组",
			},
		},
	}

	refs := collectTranslationRefs(root, []string{"data", "@key"})
	refs = append(refs, collectTranslationRefs(root, []string{"data", "*", "desc"})...)
	if len(refs) != 2 {
		t.Fatalf("refs len = %d, want 2", len(refs))
	}
	for _, ref := range refs {
		switch ref.value {
		case "默认分组":
			ref.apply("Default group")
		case "用户分组":
			ref.apply("User group")
		default:
			t.Fatalf("unexpected ref value %q", ref.value)
		}
	}

	data := root["data"].(map[string]any)
	if _, ok := data["默认分组"]; ok {
		t.Fatal("old map key still exists")
	}
	group, ok := data["Default group"].(map[string]any)
	if !ok {
		t.Fatalf("translated map key missing: %#v", data)
	}
	if group["desc"] != "User group" {
		t.Fatalf("desc = %#v, want User group", group["desc"])
	}
}

func TestNormalizeAITranslationLanguage(t *testing.T) {
	tests := map[string]string{
		"fr-FR,fr;q=0.9": "fr",
		"ja-JP":          "ja",
		"ru":             "ru",
		"vi-VN":          "vi",
		"zh-CN":          "zh",
		"en-US":          "en",
		"es-ES":          "en",
	}
	for input, want := range tests {
		if got := normalizeAITranslationLanguage(input); got != want {
			t.Fatalf("normalizeAITranslationLanguage(%q) = %q, want %q", input, got, want)
		}
	}
}
