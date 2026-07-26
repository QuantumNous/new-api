package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRewriteCanvasShareDocumentAuthorizesOnlyReferencedAssets(t *testing.T) {
	doc := `{"nodes":[{"metadata":{"assetId":12,"content":"/api/playground/assets/12/content"}},{"metadata":{"assetId":13}},{"metadata":{"content":"https://example.com/external.png"}}]}`
	rewritten, assetIds, replacements, err := rewriteCanvasShareDocument(doc, "token")
	require.NoError(t, err)
	assert.Contains(t, rewritten, "/api/share/canvas/token/assets/12")
	assert.NotContains(t, rewritten, "/api/playground/assets/12/content")
	assert.Contains(t, rewritten, "https://example.com/external.png")
	assert.Contains(t, assetIds, 12)
	assert.Contains(t, assetIds, 13)
	assert.NotContains(t, assetIds, 14)
	assert.Equal(t, "/api/share/canvas/token/assets/12", replacements["/api/playground/assets/12/content"])
}

func TestRewriteCanvasShareDocumentRejectsInvalidAssetIDs(t *testing.T) {
	doc := `{"nodes":[{"metadata":{"assetId":-1}},{"metadata":{"assetId":1.5}},{"metadata":{"assetId":"2"}}]}`
	_, assetIds, _, err := rewriteCanvasShareDocument(doc, "token")
	require.NoError(t, err)
	assert.Empty(t, assetIds)
}
