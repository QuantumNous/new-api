package service

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (fn roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestSelectLatestDockerTagPrefersHighestStableSemver(t *testing.T) {
	selected := selectLatestDockerTag([]dockerHubTag{
		{Name: "latest", LastUpdated: "2026-03-20T10:00:00Z"},
		{Name: "v0.11.5", LastUpdated: "2026-03-18T10:00:00Z"},
		{Name: "v0.11.12", LastUpdated: "2026-03-19T10:00:00Z"},
		{Name: "v0.11.12-amd64", LastUpdated: "2026-03-19T10:00:00Z"},
	}, "v0.11.5")

	if selected.Name != "v0.11.12" {
		t.Fatalf("expected latest stable tag v0.11.12, got %q", selected.Name)
	}
}

func TestSelectLatestDockerTagKeepsAlphaChannel(t *testing.T) {
	selected := selectLatestDockerTag([]dockerHubTag{
		{Name: "v0.11.6", LastUpdated: "2026-03-20T10:00:00Z"},
		{Name: "alpha-20260319-abcd123", LastUpdated: "2026-03-19T10:00:00Z"},
		{Name: "alpha-20260320-efgh456", LastUpdated: "2026-03-20T10:00:00Z"},
	}, "alpha-20260319-abcd123")

	if selected.Name != "alpha-20260320-efgh456" {
		t.Fatalf("expected latest alpha tag, got %q", selected.Name)
	}
}

func TestGetDockerImageVersionStatusUsesConfiguredRepositoryAndTag(t *testing.T) {
	previousRepository := common.DockerImageRepository
	previousTag := common.DockerImageTag
	previousAPIBase := common.DockerHubAPIBase
	previousClient := httpClient
	t.Cleanup(func() {
		common.DockerImageRepository = previousRepository
		common.DockerImageTag = previousTag
		common.DockerHubAPIBase = previousAPIBase
		httpClient = previousClient
	})

	common.DockerImageRepository = "acme/new-api"
	common.DockerImageTag = "v0.11.5"
	common.DockerHubAPIBase = "http://dockerhub.test"
	httpClient = &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if req.URL.Path != "/v2/namespaces/acme/repositories/new-api/tags" {
				t.Fatalf("unexpected path: %s", req.URL.Path)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body: io.NopCloser(strings.NewReader(`{
					"results": [
						{"name":"latest","last_updated":"2026-03-20T10:00:00Z"},
						{"name":"v0.11.6","last_updated":"2026-03-20T10:00:00Z"},
						{"name":"v0.11.5","last_updated":"2026-03-18T10:00:00Z"}
					]
				}`)),
			}, nil
		}),
	}

	status, err := GetDockerImageVersionStatus(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if status.CurrentTag != "v0.11.5" {
		t.Fatalf("expected current tag v0.11.5, got %q", status.CurrentTag)
	}
	if status.LatestTag != "v0.11.6" {
		t.Fatalf("expected latest tag v0.11.6, got %q", status.LatestTag)
	}
	if !status.UpdateAvailable {
		t.Fatalf("expected update_available=true")
	}
	if status.DetailsURL == "" {
		t.Fatalf("expected details url to be set")
	}
}
