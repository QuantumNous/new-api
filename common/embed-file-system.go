package common

import (
	"io/fs"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/static"
)

// Credit: https://github.com/gin-contrib/static/issues/19

type embedFileSystem struct {
	http.FileSystem
}

func (e *embedFileSystem) Exists(prefix string, path string) bool {
	_, err := e.Open(path)
	if err != nil {
		return false
	}
	return true
}

func (e *embedFileSystem) Open(name string) (http.File, error) {
	if name == "/" {
		// This will make sure the index page goes to NoRouter handler,
		// which will use the replaced index bytes with analytic codes.
		return nil, os.ErrNotExist
	}
	return e.FileSystem.Open(name)
}

// DiskFrontendDir returns the directory from NEW_API_WEB_DIR when it holds a
// usable frontend, and an empty string otherwise.
//
// "Usable" means index.html exists, is readable, and is not empty. EmbedFolder
// and the index page selection in main must agree on this: serving assets from
// disk while the root document still comes from the embedded build mixes asset
// hashes across two builds, which leaves the dashboard unable to load its own
// bundles. Both callers therefore ask this one function instead of validating
// the directory twice with different rules.
func DiskFrontendDir() string {
	dir := os.Getenv("NEW_API_WEB_DIR")
	if dir == "" {
		return ""
	}

	info, err := os.Stat(dir)
	if err != nil {
		SysError("NEW_API_WEB_DIR=" + dir + " is not usable (" + err.Error() + "), falling back to the embedded frontend")
		return ""
	}
	if !info.IsDir() {
		SysError("NEW_API_WEB_DIR=" + dir + " is not a directory, falling back to the embedded frontend")
		return ""
	}

	indexPath := filepath.Join(dir, "index.html")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		SysError("failed to read index page from " + indexPath + " (" + err.Error() + "), falling back to the embedded frontend")
		return ""
	}
	if len(data) == 0 {
		// An empty file would serve a blank dashboard, which is worse than the
		// stale embedded page, so treat the directory as unusable.
		SysError("index page at " + indexPath + " is empty, falling back to the embedded frontend")
		return ""
	}

	return dir
}

// EmbedFolder serves the dashboard frontend. When NEW_API_WEB_DIR points at a
// directory on disk that directory wins, so the frontend can be updated without
// rebuilding this binary; otherwise the embedded copy is used. A NEW_API_WEB_DIR
// that is set but unusable falls back to the embedded copy with a warning rather
// than failing startup, so a bad path cannot take the service down.
//
// The parameter is fs.FS rather than embed.FS: an embed.FS satisfies it, and the
// narrower interface keeps this testable without a compiled-in asset tree.
func EmbedFolder(fsEmbed fs.FS, targetPath string) static.ServeFileSystem {
	if dir := DiskFrontendDir(); dir != "" {
		SysLog("serving web frontend from " + dir)
		return &embedFileSystem{
			FileSystem: http.Dir(dir),
		}
	}

	efs, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}
	return &embedFileSystem{
		FileSystem: http.FS(efs),
	}
}
