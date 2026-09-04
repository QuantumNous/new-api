package common

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestCustomDomainComposeHealthcheckProbesConcreteHosts(t *testing.T) {
	data, err := os.ReadFile("../docker-compose.yml")
	require.NoError(t, err)
	var compose struct {
		Services map[string]struct {
			Healthcheck struct {
				Test []string `yaml:"test"`
			} `yaml:"healthcheck"`
		} `yaml:"services"`
	}
	require.NoError(t, yaml.Unmarshal(data, &compose))
	command := compose.Services["new-api"].Healthcheck.Test
	require.Len(t, command, 2)
	require.Equal(t, "CMD-SHELL", command[0])
	// Compose turns escaped dollars into literal dollars for the container shell.
	script := strings.ReplaceAll(command[1], "$$", "$")
	for _, test := range []struct {
		name      string
		origins   string
		failHost  string
		wantHosts string
	}{
		{name: "empty plural", wantHosts: "main.example\n"},
		{name: "exact peers", origins: "https://main.example, https://peer.example/ ", wantHosts: "main.example\npeer.example\n"},
		{name: "wildcards", origins: "https://main.example, https://*.yeschoy.com,https://*.yeschoy.pro ", wantHosts: "main.example\nh.yeschoy.com\nh.yeschoy.pro\n"},
		{name: "failed wildcard", origins: "https://main.example,https://*.yeschoy.com,https://*.yeschoy.pro", failHost: "h.yeschoy.com", wantHosts: "main.example\nh.yeschoy.com\n"},
	} {
		t.Run(test.name, func(t *testing.T) {
			dir := t.TempDir()
			capture := filepath.Join(dir, "hosts")
			// A local filename must not expand the configured wildcard during splitting.
			require.NoError(t, os.Mkdir(filepath.Join(dir, "https:"), 0700))
			require.NoError(t, os.WriteFile(filepath.Join(dir, "https:", "accidental.yeschoy.com"), nil, 0600))
			require.NoError(t, os.WriteFile(filepath.Join(dir, "wget"), []byte(`#!/bin/sh
set -eu
host=''
for arg in "$@"; do
  case "$arg" in --header=Host:\ *) host="${arg#--header=Host: }";; esac
done
[ -n "$host" ] || exit 2
[ "$arg" = 'http://127.0.0.1:3000/api/status' ] || exit 2
printf '%s\n' "$host" >> "$CAPTURE_HOSTS"
if [ "$host" = "$FAIL_HOST" ]; then printf '{"success":false}'; exit 1; fi
printf '{"success":true}'
`), 0700))
			cmd := exec.Command("sh", "-c", script)
			cmd.Dir = dir
			cmd.Env = []string{"PATH=" + dir + ":" + os.Getenv("PATH"), "CUSTOM_DOMAIN_MAIN_ORIGIN=https://main.example",
				"CUSTOM_DOMAIN_MAIN_ORIGINS=" + test.origins, "CAPTURE_HOSTS=" + capture, "FAIL_HOST=" + test.failHost}
			output, err := cmd.CombinedOutput()
			if test.failHost != "" {
				assert.Error(t, err, string(output))
			} else {
				assert.NoError(t, err, string(output))
			}
			hosts, err := os.ReadFile(capture)
			require.NoError(t, err)
			assert.Equal(t, test.wantHosts, string(hosts))
		})
	}
}
