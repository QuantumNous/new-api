package doubao

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAssetBelongsToScope(t *testing.T) {
	scope := &assetScope{groupId: "grp-1"}

	tests := []struct {
		name   string
		result string
		want   bool
	}{
		{"matching group", `{"Id":"a1","GroupId":"grp-1"}`, true},
		{"other user's group", `{"Id":"a2","GroupId":"grp-2"}`, false},
		{"missing group is denied", `{"Id":"a3"}`, false},
		{"invalid json is denied", `not-json`, false},
		{"empty payload is denied", ``, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, assetBelongsToScope([]byte(tc.result), scope))
		})
	}
}

func TestParseAssetGroupId(t *testing.T) {
	assert.Equal(t, "g1", parseAssetGroupId([]byte(`{"Id":"g1"}`)))
	// Fall back to the GroupId field.
	assert.Equal(t, "g2", parseAssetGroupId([]byte(`{"GroupId":"g2"}`)))
	// Id takes precedence over GroupId.
	assert.Equal(t, "g1", parseAssetGroupId([]byte(`{"Id":"g1","GroupId":"g2"}`)))
	assert.Equal(t, "", parseAssetGroupId([]byte(`{}`)))
	assert.Equal(t, "", parseAssetGroupId([]byte(``)))
	assert.Equal(t, "", parseAssetGroupId([]byte(`bad`)))
}

func TestExtractAssetId(t *testing.T) {
	assert.Equal(t, "asset-1", extractAssetId([]byte(`{"Id":"asset-1","URL":"http://x"}`)))
	assert.Equal(t, "", extractAssetId([]byte(`{"URL":"http://x"}`)))
	assert.Equal(t, "", extractAssetId([]byte(``)))
}
