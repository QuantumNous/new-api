package selfupdate

import (
	"os"
	"strings"
)

// DeployMode indicates how this process was deployed.
type DeployMode string

const (
	DeployModeBinary DeployMode = "binary"
	DeployModeDocker DeployMode = "docker"
)

// DetectDeployMode determines the deploy mode for the running process.
// Priority:
//  1. NEWAPI_DEPLOY_MODE env var ("binary" or "docker", case-insensitive).
//  2. Presence of /.dockerenv file.
//  3. /proc/1/cgroup containing "docker", "containerd", or "kubepods".
//  4. Defaults to binary.
func DetectDeployMode() DeployMode {
	if env := strings.TrimSpace(os.Getenv("NEWAPI_DEPLOY_MODE")); env != "" {
		switch strings.ToLower(env) {
		case "docker":
			return DeployModeDocker
		case "binary":
			return DeployModeBinary
		}
	}

	if _, err := os.Stat("/.dockerenv"); err == nil {
		return DeployModeDocker
	}

	if data, err := os.ReadFile("/proc/1/cgroup"); err == nil {
		lower := strings.ToLower(string(data))
		if strings.Contains(lower, "docker") ||
			strings.Contains(lower, "containerd") ||
			strings.Contains(lower, "kubepods") {
			return DeployModeDocker
		}
	}

	return DeployModeBinary
}
