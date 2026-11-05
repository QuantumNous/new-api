package contract_test

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

// TestContractPackageDoesNotImportHTTPFramework enforces the boundary rule the
// transport layer exists to create: business code depends on this contract, so
// if the contract itself imported an HTTP framework the abstraction would be
// worthless and swapping frameworks would again touch every caller.
//
// The walk covers subpackages (the conformance suite), because a framework
// import there would bind the shared assertions to one adapter and defeat the
// point of having them be shared.
func TestContractPackageDoesNotImportHTTPFramework(t *testing.T) {
	// Fiber is the only adapter and the previous framework is no longer a
	// dependency of this module, yet all three stay listed. Fiber being the sole
	// backend is the reason to keep banning it here, not a reason to relax: the
	// contract is what makes the next swap cheap, so it must not bind to the
	// incumbent. The banned import stays so a reintroduction fails this test
	// instead of passing unnoticed.
	forbidden := []string{
		"github.com/gin-gonic/gin",
		"github.com/gofiber/fiber",
		"github.com/valyala/fasthttp",
	}

	inspected := 0
	fileSet := token.NewFileSet()
	require.NoError(t, filepath.WalkDir(".", func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") {
			return nil
		}
		if strings.HasSuffix(entry.Name(), "_test.go") {
			return nil
		}

		parsed, parseErr := parser.ParseFile(fileSet, path, nil, parser.ImportsOnly)
		if parseErr != nil {
			return parseErr
		}
		inspected++

		for _, spec := range parsed.Imports {
			imported := strings.Trim(spec.Path.Value, `"`)
			for _, banned := range forbidden {
				assert.False(t,
					strings.HasPrefix(imported, banned),
					"%s imports %s; the transport contract must stay framework-neutral",
					path, imported,
				)
			}
		}
		return nil
	}))

	require.NotZero(t, inspected, "no contract source files were inspected")
}

// TestContractPackageImportsOnlyStandardLibrary asserts the contract depends on
// nothing but the standard library, keeping it importable from any layer without
// creating a dependency cycle.
//
// This one deliberately inspects only the package root, unlike the
// framework-neutrality check above: the conformance subpackage is test support
// and legitimately imports a testing library.
func TestContractPackageImportsOnlyStandardLibrary(t *testing.T) {
	entries, err := os.ReadDir(".")
	require.NoError(t, err)

	fileSet := token.NewFileSet()
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}

		parsed, err := parser.ParseFile(fileSet, filepath.Join(".", entry.Name()), nil, parser.ImportsOnly)
		require.NoError(t, err)

		for _, spec := range parsed.Imports {
			path := strings.Trim(spec.Path.Value, `"`)
			firstSegment := strings.SplitN(path, "/", 2)[0]
			assert.False(t,
				strings.Contains(firstSegment, "."),
				"%s imports external module %s; the contract must depend only on the standard library",
				entry.Name(), path,
			)
		}
	}
}
