package selfupdate

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestLoadConfigDefaults(t *testing.T) {
	for _, key := range []string{
		"NEWAPI_UPDATE_ENABLED",
		"NEWAPI_UPDATE_REPO",
		"NEWAPI_DOCKER_HOST",
		"NEWAPI_DOCKER_IMAGE",
		"NEWAPI_GITHUB_TOKEN",
		"NEWAPI_COMPOSE_SYNC_ENABLED",
		"NEWAPI_COMPOSE_FILE",
		"NEWAPI_COMPOSE_SERVICE",
	} {
		t.Setenv(key, "")
	}

	cfg := LoadConfig()
	assert.True(t, cfg.Enabled)
	assert.Equal(t, "ChinaToyHunter/new-api", cfg.Repo)
	assert.Equal(t, "unix:///var/run/docker.sock", cfg.DockerHost)
	assert.Empty(t, cfg.DockerImage)
	assert.Empty(t, cfg.GitHubToken)
	assert.False(t, cfg.ComposeSyncEnabled)
	assert.Empty(t, cfg.ComposeFile)
	assert.Empty(t, cfg.ComposeService)
	assert.Equal(t, 20*time.Minute, cfg.CacheTTL)
}

func TestLoadConfigComposeValuesAndInvalidBool(t *testing.T) {
	t.Setenv("NEWAPI_COMPOSE_SYNC_ENABLED", "true")
	t.Setenv("NEWAPI_COMPOSE_FILE", "/opt/new-api/docker-compose.yml")
	t.Setenv("NEWAPI_COMPOSE_SERVICE", "new-api")

	cfg := LoadConfig()
	assert.True(t, cfg.ComposeSyncEnabled)
	assert.Equal(t, "/opt/new-api/docker-compose.yml", cfg.ComposeFile)
	assert.Equal(t, "new-api", cfg.ComposeService)

	t.Setenv("NEWAPI_COMPOSE_SYNC_ENABLED", "not-a-bool")
	cfg = LoadConfig()
	assert.False(t, cfg.ComposeSyncEnabled)
}
