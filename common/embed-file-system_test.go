package common

import (
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestFS builds an embed.FS stand-in laid out like the real one, which always
// has a "web/dist" prefix in front of the dashboard files.
func newTestFS() fs.FS {
	return fstest.MapFS{
		"web/dist/index.html":      {Data: []byte("<html>embedded</html>")},
		"web/dist/static/app.js":   {Data: []byte("console.log(1)")},
		"web/dist/static/app.css":  {Data: []byte("body{}")},
		"web/dist/some/deep/f.txt": {Data: []byte("deep")},
	}
}

// openFile is a small helper: ServeFileSystem only exposes Exists/Open, so the
// tests read through Open and close the handle.
func openFile(t *testing.T, sfs interface{ Open(string) (http.File, error) }, name string) (string, error) {
	t.Helper()
	f, err := sfs.Open(name)
	if err != nil {
		return "", err
	}
	defer f.Close()

	buf := make([]byte, 1024)
	n, _ := f.Read(buf)

	return string(buf[:n]), nil
}

func TestEmbedFolderFallsBackToEmbeddedFiles(t *testing.T) {
	t.Setenv("NEW_API_WEB_DIR", "")

	fsys := EmbedFolder(newTestFS(), "web/dist")

	// The embedded copy is mounted at the root, so the dist prefix is stripped.
	assert.True(t, fsys.Exists("", "/index.html"))
	assert.True(t, fsys.Exists("", "/static/app.js"))
	assert.False(t, fsys.Exists("", "/static/missing.js"))

	body, err := openFile(t, fsys, "/index.html")
	require.NoError(t, err)
	assert.Equal(t, "<html>embedded</html>", body)
}

func TestEmbedFolderServesFromDiskWhenDirIsSet(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "static"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>disk</html>"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "static", "app.js"), []byte("disk-js"), 0o644))

	t.Setenv("NEW_API_WEB_DIR", dir)

	fsys := EmbedFolder(newTestFS(), "web/dist")

	body, err := openFile(t, fsys, "/index.html")
	require.NoError(t, err)
	assert.Equal(t, "<html>disk</html>", body, "disk content must win over the embedded copy")

	js, err := openFile(t, fsys, "/static/app.js")
	require.NoError(t, err)
	assert.Equal(t, "disk-js", js)

	// A file present only in the embedded copy must not leak through: the disk
	// directory is authoritative, not merged.
	assert.False(t, fsys.Exists("", "/some/deep/f.txt"))
}

// A stale NEW_API_WEB_DIR (e.g. a removed volume) must not take the dashboard
// down; the embedded copy is still a working frontend.
func TestEmbedFolderFallsBackWhenDirIsMissing(t *testing.T) {
	t.Setenv("NEW_API_WEB_DIR", filepath.Join(t.TempDir(), "does-not-exist"))

	fsys := EmbedFolder(newTestFS(), "web/dist")

	body, err := openFile(t, fsys, "/index.html")
	require.NoError(t, err)
	assert.Equal(t, "<html>embedded</html>", body)
}

// Pointing NEW_API_WEB_DIR at a regular file is a config mistake, not a crash.
func TestEmbedFolderFallsBackWhenPathIsNotADirectory(t *testing.T) {
	file := filepath.Join(t.TempDir(), "not-a-dir")
	require.NoError(t, os.WriteFile(file, []byte("x"), 0o644))

	t.Setenv("NEW_API_WEB_DIR", file)

	fsys := EmbedFolder(newTestFS(), "web/dist")

	assert.True(t, fsys.Exists("", "/index.html"))
}

// Root must keep resolving to the NoRouter handler so the analytics-injected
// index bytes are used; both backends rely on this.
func TestEmbedFolderRootIsNotServedDirectly(t *testing.T) {
	for name, setup := range map[string]func(*testing.T){
		"embedded": func(t *testing.T) { t.Setenv("NEW_API_WEB_DIR", "") },
		"disk": func(t *testing.T) {
			dir := t.TempDir()
			require.NoError(t, os.WriteFile(filepath.Join(dir, "index.html"), []byte("disk"), 0o644))
			t.Setenv("NEW_API_WEB_DIR", dir)
		},
	} {
		t.Run(name, func(t *testing.T) {
			setup(t)

			fsys := EmbedFolder(newTestFS(), "web/dist")

			assert.False(t, fsys.Exists("", "/"))
			_, err := fsys.Open("/")
			assert.ErrorIs(t, err, os.ErrNotExist)
		})
	}
}
