package console_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateCustomPages(t *testing.T) {
	t.Parallel()

	require.NoError(t, ValidateConsoleSettings("[]", "CustomPages"))
	require.NoError(t, ValidateConsoleSettings("", "CustomPages"))

	err := ValidateConsoleSettings(`[
		{"id":"cp_a","title":"Docs","icon":"BookOpen","url":"https://example.com","enabled":true,"open_mode":"external","sort":1}
	]`, "CustomPages")
	require.NoError(t, err)

	err = ValidateConsoleSettings(`[
		{"id":"cp_a","title":"Docs","url":"https://example.com","enabled":true,"open_mode":"popup"}
	]`, "CustomPages")
	require.Error(t, err)

	err = ValidateConsoleSettings(`[
		{"id":"bad id","title":"Docs","url":"https://example.com","enabled":true}
	]`, "CustomPages")
	require.Error(t, err)

	err = ValidateConsoleSettings(`[
		{"id":"cp_a","title":"Docs","url":"not-a-url","enabled":true}
	]`, "CustomPages")
	require.Error(t, err)

	err = ValidateConsoleSettings(`[
		{"id":"cp_a","title":"Docs","icon":"NotAnIcon","url":"https://example.com","enabled":true}
	]`, "CustomPages")
	require.Error(t, err)
}

func TestGetCustomPagesFiltersAndSorts(t *testing.T) {
	previous := consoleSetting.CustomPages
	t.Cleanup(func() {
		consoleSetting.CustomPages = previous
	})

	consoleSetting.CustomPages = `[
		{"id":"cp_b","title":"B","icon":"Globe","url":"https://b.example.com","enabled":true,"open_mode":"external","sort":2},
		{"id":"cp_off","title":"Off","icon":"Link","url":"https://off.example.com","enabled":false,"sort":0},
		{"id":"cp_a","title":"A","icon":"BookOpen","url":"https://a.example.com","enabled":true,"sort":1},
		{"id":"cp_empty","title":"Empty","icon":"Link","url":"","enabled":true,"sort":0}
	]`

	pages := GetCustomPages()
	require.Len(t, pages, 2)
	assert.Equal(t, "cp_a", pages[0]["id"])
	assert.Equal(t, "cp_b", pages[1]["id"])
	assert.Equal(t, "BookOpen", pages[0]["icon"])
	assert.Equal(t, "embed", pages[0]["open_mode"])
	assert.Equal(t, "external", pages[1]["open_mode"])
	_, hasSort := pages[0]["sort"]
	assert.False(t, hasSort)
}
