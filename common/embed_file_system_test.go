package common

import (
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/require"
)

func TestEmbedFileSystemExistsStripsNonRootPrefix(t *testing.T) {
	assets := fstest.MapFS{
		"dist/index.html":    {Data: []byte("index")},
		"dist/assets/app.js": {Data: []byte("app")},
	}
	filesystem := EmbedFolder(assets, "dist")

	require.True(t, filesystem.Exists("/next", "/next/assets/app.js"))
	require.False(t, filesystem.Exists("/next", "/other/assets/app.js"))
	require.False(t, filesystem.Exists("/next", "/next"))
}

func TestEmbedFileSystemKeepsRootBehavior(t *testing.T) {
	assets := fstest.MapFS{
		"dist/assets/app.js": {Data: []byte("app")},
	}
	filesystem := EmbedFolder(assets, "dist")

	require.True(t, filesystem.Exists("/", "/assets/app.js"))
	require.False(t, filesystem.Exists("/", "/"))
}
