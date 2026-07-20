package relayconvert

// boundary_test.go enforces the relaykit extraction dependency boundary
// (plans/relaykit-extraction-plan.md): packages that will move into the
// relaykit module must not grow imports of host-only packages. Entries in
// allowedViolations are the known couplings scheduled for removal in
// Phase 1/2 — shrink this list, never grow it.

import (
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const modulePrefix = "github.com/QuantumNous/new-api/"

// Packages (relative to repo root) that will become part of relaykit.
var kitDirs = []string{
	"service/relayconvert",
	"dto",
	"types",
	"relay/reasonmap",
}

// Host-only import prefixes forbidden inside kit packages.
var forbiddenPrefixes = []string{
	modulePrefix + "model",
	modulePrefix + "setting",
	modulePrefix + "controller",
	modulePrefix + "middleware",
	modulePrefix + "logger",
	"github.com/gin-gonic/gin",
}

// Known pre-existing couplings, removed phase by phase. Key: "dir|import".
var allowedViolations = map[string]bool{
	// Phase 1 removes gin.Context passthrough and setting reads.
	"service/relayconvert|github.com/gin-gonic/gin":                  true,
	"service/relayconvert|" + modulePrefix + "setting/model_setting": true,
	"service/relayconvert|" + modulePrefix + "setting/reasoning":     true,
	// Phase 2 removes dto's gin helper methods (IsStream(c) etc.) and logger reach.
	"dto|github.com/gin-gonic/gin":   true,
	"dto|" + modulePrefix + "logger": true,
}

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
					if importPath != prefix && !strings.HasPrefix(importPath, prefix+"/") {
						continue
					}
					if allowedViolations[dir+"|"+importPath] {
						continue
					}
					rel, _ := filepath.Rel(root, path)
					t.Errorf("%s imports %q — forbidden inside future relaykit package %s (see plans/relaykit-extraction-plan.md)", rel, importPath, dir)
				}
			}
			return nil
		})
		if err != nil {
			t.Fatalf("walking %s: %v", dir, err)
		}
	}
}

func repoRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("go.mod not found above test directory")
		}
		dir = parent
	}
}
