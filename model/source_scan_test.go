package model

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// readModuleGoSources returns every Go source file in the repository keyed by
// its module-relative path. It is used by static guarantees that are easier to
// state over source text than over the type system.
func readModuleGoSources(t *testing.T) map[string]string {
	t.Helper()
	root, err := filepath.Abs("..")
	require.NoError(t, err)

	sources := make(map[string]string)
	require.NoError(t, filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			switch entry.Name() {
			case "node_modules", ".git", "dist", "web":
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		content, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		relative, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return relErr
		}
		sources[filepath.ToSlash(relative)] = string(content)
		return nil
	}))
	require.NotEmpty(t, sources)
	return sources
}
