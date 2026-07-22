package i18n

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestInitLoadsAllLocales verifies that every embedded locale file parses and
// the bundle initializes without error. This guards against malformed YAML when
// a new locale is added.
func TestInitLoadsAllLocales(t *testing.T) {
	require.NoError(t, Init())

	for _, lang := range SupportedLanguages() {
		assert.Contains(t, localizers, lang, "localizer not pre-created for %s", lang)
	}
}

// TestTranslatePtBR verifies a pt-BR translation resolves correctly, including
// placeholder substitution, exercising the full embed -> load -> localize path.
func TestTranslatePtBR(t *testing.T) {
	require.NoError(t, Init())

	got := Translate(LangPtBR, MsgOperationSuccess)
	assert.Equal(t, "Operação concluída com sucesso", got)

	// Placeholder substitution in pt-BR
	got = Translate(LangPtBR, MsgBatchTooMany, map[string]any{"Max": 100})
	assert.Contains(t, got, "100")
	assert.Contains(t, got, "máximo")
}

// TestNormalizeLangPtBR verifies that common pt-BR variants resolve to the
// pt-BR locale rather than falling back to the default (English).
func TestNormalizeLangPtBR(t *testing.T) {
	variants := []string{"pt-BR", "pt-br", "pt", "pt-PT", "pt_BR"}
	for _, v := range variants {
		assert.True(t, IsSupported(v), "expected %s to be supported", v)
	}
}
