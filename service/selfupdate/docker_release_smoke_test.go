package selfupdate

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestDockerReleasePullSmoke(t *testing.T) {
	if os.Getenv("NEWAPI_SELFUPDATE_DOCKER_SMOKE") != "1" {
		t.Skip("set NEWAPI_SELFUPDATE_DOCKER_SMOKE=1 to run the Docker release smoke test")
	}

	targetImage := strings.TrimSpace(os.Getenv("NEWAPI_SELFUPDATE_SMOKE_IMAGE"))
	if targetImage == "" {
		t.Fatal("NEWAPI_SELFUPDATE_SMOKE_IMAGE is required")
	}
	dockerHost := strings.TrimSpace(os.Getenv("NEWAPI_SELFUPDATE_SMOKE_DOCKER_HOST"))
	if dockerHost == "" {
		dockerHost = "unix:///var/run/docker.sock"
	}

	engine, err := NewDockerEngine(dockerHost)
	if err != nil {
		t.Fatalf("create Docker engine: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if err := engine.RecreateSelf(ctx, targetImage); err != nil {
		t.Fatalf("pull image and schedule replacement: %v", err)
	}
}
