package selfupdate

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDetectDeployModeOverride(t *testing.T) {
	t.Setenv("NEWAPI_DEPLOY_MODE", "docker")
	assert.Equal(t, DeployModeDocker, DetectDeployMode())
	t.Setenv("NEWAPI_DEPLOY_MODE", "binary")
	assert.Equal(t, DeployModeBinary, DetectDeployMode())
}
