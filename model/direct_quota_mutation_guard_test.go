package model

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDirectQuotaMutationGuard(t *testing.T) {
	root := ".."
	allowed := map[string]bool{
		filepath.Clean("model/quota_lifecycle.go"):                  true,
		filepath.Clean("model/direct_quota_mutation_guard_test.go"): true,
	}
	var violations []string
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			switch d.Name() {
			case ".git", ".omx", "node_modules", "web", "website", "docs":
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".go" {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		if allowed[filepath.Clean(rel)] || strings.HasSuffix(rel, "_test.go") || strings.Contains(rel, "migration") {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		violations = append(violations, directQuotaMutationViolations(rel, string(content))...)
		return nil
	})
	require.NoError(t, err)
	require.Empty(t, violations, "direct quota/subscription balance arithmetic must route through quota_lifecycle.go")
}

func directQuotaMutationViolations(rel string, text string) []string {
	lines := strings.Split(text, "\n")
	var violations []string
	for i, line := range lines {
		if strings.Contains(line, "UPDATE users SET quota") {
			violations = append(violations, rel+": UPDATE users SET quota")
		}
		if strings.Contains(line, `Update("quota"`) && nearbyUserMutationTarget(lines, i) {
			violations = append(violations, rel+": users.quota Update")
		}
		if strings.Contains(line, `"quota":`) && strings.Contains(line, `gorm.Expr("quota`) && nearbyUserMutationTarget(lines, i) {
			violations = append(violations, rel+": users.quota gorm.Expr")
		}
		if strings.Contains(line, "AmountUsed +") || strings.Contains(line, "AmountUsed -") ||
			strings.Contains(line, "amount_used +") || strings.Contains(line, "amount_used -") {
			violations = append(violations, rel+": subscription amount_used arithmetic")
		}
	}
	return violations
}

func nearbyUserMutationTarget(lines []string, index int) bool {
	start := index - 5
	if start < 0 {
		start = 0
	}
	for i := start; i <= index && i < len(lines); i++ {
		line := lines[i]
		if strings.Contains(line, "Model(&User{}") ||
			strings.Contains(line, "Model(&model.User{}") ||
			strings.Contains(line, `Table("users"`) ||
			strings.Contains(line, "`users`") {
			return true
		}
	}
	return false
}
