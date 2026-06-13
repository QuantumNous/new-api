package i18n

import (
	"strings"
	"testing"
)

// Verifies the verification / password-reset email keys exist in every locale,
// render template data, and are actually localized (not all identical / not the
// raw key as a missing-translation fallback).
func TestEmailContentLocalized(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("i18n init failed: %v", err)
	}

	data := map[string]any{
		"SystemName": "flatkey",
		"Code":       "0b0442",
		"Minutes":    10,
		"Link":       "https://flatkey.ai/user/reset?email=a@b.com&token=x",
	}

	keys := []string{
		MsgEmailVerifySubject,
		MsgEmailVerifyContent,
		MsgEmailResetSubject,
		MsgEmailResetContent,
	}
	langs := []string{LangEn, LangZhCN, LangZhTW, LangPt, LangEs, LangFr, LangRu, LangJa, LangVi}

	for _, key := range keys {
		for _, lang := range langs {
			out := Translate(lang, key, data)
			if out == key {
				t.Errorf("key %q lang %q returned the raw key (missing translation)", key, lang)
			}
			if strings.Contains(out, "{{") {
				t.Errorf("key %q lang %q has unrendered template: %s", key, lang, out)
			}
			// A mistyped field (e.g. {{.Cod}}) renders to "<no value>" rather
			// than leaving "{{", so check for it explicitly in every locale.
			if strings.Contains(out, "<no value>") {
				t.Errorf("key %q lang %q has an unknown template field (<no value>): %s", key, lang, out)
			}
			if !strings.Contains(out, "flatkey") {
				t.Errorf("key %q lang %q did not render SystemName: %s", key, lang, out)
			}
		}
	}

	// Every supported language must produce a distinct verification subject —
	// catches an English (or any) placeholder copied across locales.
	seen := map[string]string{}
	for _, lang := range langs {
		subj := Translate(lang, MsgEmailVerifySubject, data)
		if prev, ok := seen[subj]; ok {
			t.Errorf("verification subject for %q duplicates %q: %q", lang, prev, subj)
		}
		seen[subj] = lang
	}

	// Email-only locales must fall back to English for non-email keys, never to
	// the raw key.
	for _, lang := range []string{LangEs, LangFr, LangRu, LangJa, LangVi} {
		got := Translate(lang, MsgInvalidParams)
		want := Translate(LangEn, MsgInvalidParams)
		if got != want {
			t.Errorf("non-email key for %q should fall back to English %q, got %q", lang, want, got)
		}
	}

	// Content must carry the code / link / minutes through template data.
	if got := Translate(LangEn, MsgEmailVerifyContent, data); !strings.Contains(got, "0b0442") || !strings.Contains(got, "10") {
		t.Errorf("verification content missing code/minutes: %s", got)
	}
	if got := Translate(LangEn, MsgEmailResetContent, data); !strings.Contains(got, data["Link"].(string)) {
		t.Errorf("reset content missing link: %s", got)
	}

	// An unsupported language falls back to English, never to Chinese.
	en := Translate(LangEn, MsgEmailVerifySubject, data)
	if got := Translate("ko", MsgEmailVerifySubject, data); got != en {
		t.Errorf("unsupported lang should fall back to English %q, got %q", en, got)
	}
}
