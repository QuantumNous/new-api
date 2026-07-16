package selfupdate

import (
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Config holds runtime configuration for the self-update subsystem.
type Config struct {
	Enabled     bool
	Repo        string
	DockerHost  string
	DockerImage string
	GitHubToken string
	CacheTTL    time.Duration
}

// LoadConfig reads self-update configuration from environment variables with
// sensible defaults.
func LoadConfig() Config {
	return Config{
		Enabled:     common.GetEnvOrDefaultBool("NEWAPI_UPDATE_ENABLED", true),
		Repo:        common.GetEnvOrDefaultString("NEWAPI_UPDATE_REPO", "ChinaToyHunter/new-api"),
		DockerHost:  common.GetEnvOrDefaultString("NEWAPI_DOCKER_HOST", "unix:///var/run/docker.sock"),
		DockerImage: common.GetEnvOrDefaultString("NEWAPI_DOCKER_IMAGE", ""),
		GitHubToken: common.GetEnvOrDefaultString("NEWAPI_GITHUB_TOKEN", ""),
		CacheTTL:    20 * time.Minute,
	}
}
