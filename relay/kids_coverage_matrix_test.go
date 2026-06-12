package relay

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// TestKidsModeCoverageMatrix verifies that every test function listed in
// docs/kids-coverage-matrix.md actually exists somewhere in the codebase.
// CI fails here the moment a function is listed in the matrix but renamed,
// deleted, or never written — preventing the matrix from drifting silently.
func TestKidsModeCoverageMatrix(t *testing.T) {
	repoRoot := ".." // relay/ sits one level below repo root
	matrixPath := filepath.Join(repoRoot, "docs", "kids-coverage-matrix.md")

	required := extractMatrixTestFunctions(t, matrixPath)
	if len(required) == 0 {
		t.Fatal("no test functions found in kids-coverage-matrix.md — file missing or malformed")
	}

	existing := indexTestFunctions(t, repoRoot)

	var missing []string
	for _, fn := range required {
		if !existsInIndex(fn, existing) {
			missing = append(missing, fn)
		}
	}

	if len(missing) > 0 {
		t.Errorf(
			"kids-coverage-matrix.md lists %d function(s) not found in the codebase:\n  %s\n\n"+
				"Either implement the missing tests or remove them from the matrix.",
			len(missing), strings.Join(missing, "\n  "),
		)
	}
}

var testIdentifierRE = regexp.MustCompile(`\bTest[A-Za-z0-9_]+`)

// extractMatrixTestFunctions reads the matrix markdown and returns every
// unique Test* name found in it. Trailing underscores produced by wildcard
// patterns like `TestFoo_*` are stripped so they become prefix entries.
func extractMatrixTestFunctions(t *testing.T, path string) []string {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatalf("cannot open matrix file %s: %v", path, err)
	}
	defer f.Close()

	seen := make(map[string]bool)
	var out []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		// Only extract from markdown table rows (lines containing "|").
		// Code blocks and CI command snippets may contain Test* tokens that are
		// -run regex patterns, not function declarations, and must be skipped.
		if !strings.Contains(line, "|") {
			continue
		}
		for _, raw := range testIdentifierRE.FindAllString(line, -1) {
			name := strings.TrimRight(raw, "_") // normalize `TestFoo_*` → `TestFoo`
			if !seen[name] {
				seen[name] = true
				out = append(out, name)
			}
		}
	}
	return out
}

// indexTestFunctions walks every *_test.go file under root and returns a set
// of all top-level `func Test*` declaration names.
func indexTestFunctions(t *testing.T, root string) map[string]bool {
	t.Helper()
	index := make(map[string]bool)
	funcDeclRE := regexp.MustCompile(`^func (Test[A-Za-z0-9_]+)\(`)

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if !strings.HasSuffix(path, "_test.go") {
			return nil
		}
		f, openErr := os.Open(path)
		if openErr != nil {
			return openErr
		}
		defer f.Close()
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			if m := funcDeclRE.FindStringSubmatch(sc.Text()); m != nil {
				index[m[1]] = true
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("error walking repo for test functions: %v", err)
	}
	return index
}

// existsInIndex checks for an exact match first, then a prefix match so that
// wildcard entries like TestFoo (from `TestFoo_*`) match TestFoo_Bar, etc.
func existsInIndex(fn string, index map[string]bool) bool {
	if index[fn] {
		return true
	}
	prefix := fn + "_"
	for k := range index {
		if strings.HasPrefix(k, prefix) {
			return true
		}
	}
	return false
}
