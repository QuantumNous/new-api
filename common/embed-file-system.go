package common

import (
	"io/fs"
	"net/http"
	"os"

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

// EmbedFolder serves the dashboard frontend. When NEW_API_WEB_DIR points at a
// directory on disk that directory wins, so the frontend can be updated without
// rebuilding this binary; otherwise the embedded copy is used. A NEW_API_WEB_DIR
// that is set but unusable falls back to the embedded copy with a warning rather
// than failing startup, so a bad path cannot take the service down.
//
// The parameter is fs.FS rather than embed.FS: an embed.FS satisfies it, and the
// narrower interface keeps this testable without a compiled-in asset tree.
func EmbedFolder(fsEmbed fs.FS, targetPath string) static.ServeFileSystem {
	if dir := os.Getenv("NEW_API_WEB_DIR"); dir != "" {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			SysLog("serving web frontend from " + dir)
			return &embedFileSystem{
				FileSystem: http.Dir(dir),
			}
		} else if err != nil {
			SysError("NEW_API_WEB_DIR=" + dir + " is not usable (" + err.Error() + "), falling back to the embedded frontend")
		} else {
			SysError("NEW_API_WEB_DIR=" + dir + " is not a directory, falling back to the embedded frontend")
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
