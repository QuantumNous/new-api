package githubcopilot

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	defaultDataDir    = "/data/copilot"
	DefaultCLIVersion = "1.0.83"
)

func dataDir() string {
	dir := strings.TrimSpace(os.Getenv("COPILOT_DATA_DIR"))
	if dir == "" {
		dir = defaultDataDir
	}
	absolute, err := filepath.Abs(dir)
	if err != nil {
		return dir
	}
	return absolute
}

func profilesDir() string {
	return filepath.Join(dataDir(), "profiles")
}

func cacheDir() string {
	return filepath.Join(dataDir(), "cache")
}

func workDir() string {
	return filepath.Join(dataDir(), "work")
}

func cliPath() (string, error) {
	if configured := strings.TrimSpace(os.Getenv("COPILOT_CLI_PATH")); configured != "" {
		return configured, nil
	}
	path, err := exec.LookPath("copilot")
	if err != nil {
		return "", fmt.Errorf("GitHub Copilot CLI %s is not installed", DefaultCLIVersion)
	}
	return path, nil
}

func ensureRuntimeDirs() error {
	for _, dir := range []string{profilesDir(), cacheDir(), workDir()} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("create Copilot data directory: %w", err)
		}
	}
	return nil
}

func profileDir(profileID string) (string, error) {
	canonical, err := canonicalProfileID(profileID)
	if err != nil {
		return "", err
	}
	base, err := filepath.Abs(profilesDir())
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, canonical)
	relative, err := filepath.Rel(base, dir)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("invalid Copilot profile path")
	}
	return dir, nil
}

func isolatedEnvironment(profileDir string) []string {
	blocked := map[string]struct{}{
		"COPILOT_GITHUB_TOKEN":                {},
		"GH_TOKEN":                            {},
		"GITHUB_TOKEN":                        {},
		"GITHUB_COPILOT_API_TOKEN":            {},
		"COPILOT_API_URL":                     {},
		"COPILOT_SDK_AUTH_TOKEN":              {},
		"COPILOT_OFFLINE":                     {},
		"COPILOT_DISABLE_KEYTAR":              {},
		"COPILOT_ALLOW_GET_PROVIDER_ENDPOINT": {},
		"COPILOT_HOME":                        {},
		"HOME":                                {},
		"XDG_CACHE_HOME":                      {},
		"XDG_CONFIG_HOME":                     {},
	}
	env := make([]string, 0, len(os.Environ())+8)
	for _, item := range os.Environ() {
		key, _, ok := strings.Cut(item, "=")
		if !ok {
			continue
		}
		upper := strings.ToUpper(key)
		if _, found := blocked[upper]; found || strings.HasPrefix(upper, "COPILOT_PROVIDER_") {
			continue
		}
		env = append(env, item)
	}
	return append(env,
		"COPILOT_HOME="+profileDir,
		"HOME="+profileDir,
		"XDG_CACHE_HOME="+cacheDir(),
		"XDG_CONFIG_HOME="+filepath.Join(profileDir, "config"),
		"COPILOT_ALLOW_GET_PROVIDER_ENDPOINT=true",
	)
}
