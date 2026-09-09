package relayconvert

// boundary_test.go keeps the independent relaykit module free of host-only
// packages and Gin.

import (
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const modulePrefix = "github.com/QuantumNous/new-api/"

// Packages (relative to the relaykit module root) covered by the boundary.
var kitDirs = []string{
	"relayconvert",
	"dto",
	"types",
	"reasonmap",
}

// Import prefixes forbidden inside the kit module: the entire host module
// (everything outside relaykit/) and gin.
var forbiddenPrefixes = []string{
	modulePrefix,
	"github.com/gin-gonic/gin",
}

// hostModuleExceptions are host-prefix imports that are actually the kit's
// own packages (the kit module path nests under the host path).
const kitModulePrefix = modulePrefix + "relaykit/"

func TestRelaykitBoundary(t *testing.T) {
	root := repoRoot(t)
	fset := token.NewFileSet()

	for _, dir := range kitDirs {
		err := filepath.WalkDir(filepath.Join(root, dir), func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			file, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
			if err != nil {
				return err
			}
			for _, imp := range file.Imports {
				importPath := strings.Trim(imp.Path.Value, `"`)
				for _, prefix := range forbiddenPrefixes {
					if importPath != prefix && !strings.HasPrefix(importPath, prefix) {
						continue
					}
					if strings.HasPrefix(importPath, kitModulePrefix) {
						continue
					}
					rel, _ := filepath.Rel(root, path)
					assert.Failf(t, "forbidden relaykit import", "%s imports %q — forbidden inside relaykit package %s", rel, importPath, dir)
				}
			}
			return nil
		})
		require.NoError(t, err, "walking %s", dir)
	}
}

func repoRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	require.NoError(t, err)
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		require.NotEqual(t, dir, parent, "go.mod not found above test directory")
		dir = parent
	}
}
