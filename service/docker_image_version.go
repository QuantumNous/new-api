package service

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

var (
	stableDockerTagPattern     = regexp.MustCompile(`^v?(\d+)\.(\d+)\.(\d+)$`)
	archDockerTagSuffixPattern = regexp.MustCompile(`-(amd64|arm64)$`)
)

const (
	dockerTagChannelStable = "stable"
	dockerTagChannelAlpha  = "alpha"
	dockerTagChannelOther  = "other"
)

type DockerImageVersionStatus struct {
	Repository      string `json:"repository"`
	CurrentTag      string `json:"current_tag"`
	CurrentVersion  string `json:"current_version"`
	LatestTag       string `json:"latest_tag"`
	UpdateAvailable bool   `json:"update_available"`
	LastUpdated     string `json:"last_updated"`
	DetailsURL      string `json:"details_url"`
}

type dockerHubTagListResponse struct {
	Next    string         `json:"next"`
	Results []dockerHubTag `json:"results"`
}

type dockerHubTag struct {
	Name        string `json:"name"`
	LastUpdated string `json:"last_updated"`
}

type dockerSemver struct {
	Major int
	Minor int
	Patch int
}

func GetCurrentDockerImageVersion() string {
	if common.DockerImageTag != "" {
		return common.DockerImageTag
	}
	return common.Version
}

func GetDockerImageVersionStatus(ctx context.Context) (*DockerImageVersionStatus, error) {
	repository := common.DockerImageRepository
	currentTag := GetCurrentDockerImageVersion()
	latestTag, lastUpdated, err := getLatestDockerTag(ctx, repository, currentTag)
	if err != nil {
		return nil, err
	}

	return &DockerImageVersionStatus{
		Repository:      repository,
		CurrentTag:      currentTag,
		CurrentVersion:  currentTag,
		LatestTag:       latestTag,
		UpdateAvailable: latestTag != "" && latestTag != currentTag,
		LastUpdated:     lastUpdated,
		DetailsURL:      buildDockerHubTagURL(repository, latestTag),
	}, nil
}

func getLatestDockerTag(ctx context.Context, repository string, currentTag string) (string, string, error) {
	namespace, repoName, err := splitDockerRepository(repository)
	if err != nil {
		return "", "", err
	}

	baseURL := strings.TrimRight(common.DockerHubAPIBase, "/")
	requestURL := fmt.Sprintf("%s/v2/namespaces/%s/repositories/%s/tags?page_size=100", baseURL, url.PathEscape(namespace), url.PathEscape(repoName))

	allTags := make([]dockerHubTag, 0, 32)
	client := GetHttpClient()
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	for page := 0; page < 3 && requestURL != ""; page++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
		if err != nil {
			return "", "", err
		}
		req.Header.Set("Accept", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return "", "", err
		}
		if resp.StatusCode != http.StatusOK {
			_ = resp.Body.Close()
			return "", "", fmt.Errorf("docker hub tags request failed with status %d", resp.StatusCode)
		}

		var payload dockerHubTagListResponse
		err = common.DecodeJson(resp.Body, &payload)
		_ = resp.Body.Close()
		if err != nil {
			return "", "", err
		}

		allTags = append(allTags, payload.Results...)
		requestURL = payload.Next
	}

	best := selectLatestDockerTag(allTags, currentTag)
	return best.Name, best.LastUpdated, nil
}

func selectLatestDockerTag(tags []dockerHubTag, currentTag string) dockerHubTag {
	channel := dockerTagChannel(normalizeDockerTag(currentTag))

	filtered := make([]dockerHubTag, 0, len(tags))
	for _, tag := range tags {
		normalized := normalizeDockerTag(tag.Name)
		if normalized == "" || normalized == "latest" {
			continue
		}
		if dockerTagChannel(normalized) != channel {
			continue
		}
		filtered = append(filtered, dockerHubTag{Name: normalized, LastUpdated: tag.LastUpdated})
	}

	if len(filtered) == 0 && channel != dockerTagChannelStable {
		for _, tag := range tags {
			normalized := normalizeDockerTag(tag.Name)
			if normalized == "" || normalized == "latest" {
				continue
			}
			if dockerTagChannel(normalized) != dockerTagChannelStable {
				continue
			}
			filtered = append(filtered, dockerHubTag{Name: normalized, LastUpdated: tag.LastUpdated})
		}
		channel = dockerTagChannelStable
	}

	if len(filtered) == 0 {
		return dockerHubTag{}
	}

	if channel == dockerTagChannelStable {
		best := filtered[0]
		bestVersion, ok := parseDockerSemver(best.Name)
		if !ok {
			return best
		}
		for _, candidate := range filtered[1:] {
			candidateVersion, ok := parseDockerSemver(candidate.Name)
			if !ok {
				continue
			}
			if compareDockerSemver(candidateVersion, bestVersion) > 0 {
				best = candidate
				bestVersion = candidateVersion
			}
		}
		return best
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].LastUpdated > filtered[j].LastUpdated
	})
	return filtered[0]
}

func dockerTagChannel(tag string) string {
	switch {
	case tag == "", tag == "latest":
		return dockerTagChannelStable
	case stableDockerTagPattern.MatchString(tag):
		return dockerTagChannelStable
	case strings.HasPrefix(tag, "alpha-"):
		return dockerTagChannelAlpha
	default:
		return dockerTagChannelOther
	}
}

func normalizeDockerTag(tag string) string {
	if tag == "" {
		return ""
	}
	return archDockerTagSuffixPattern.ReplaceAllString(tag, "")
}

func parseDockerSemver(tag string) (dockerSemver, bool) {
	matches := stableDockerTagPattern.FindStringSubmatch(tag)
	if len(matches) != 4 {
		return dockerSemver{}, false
	}
	major, err := strconv.Atoi(matches[1])
	if err != nil {
		return dockerSemver{}, false
	}
	minor, err := strconv.Atoi(matches[2])
	if err != nil {
		return dockerSemver{}, false
	}
	patch, err := strconv.Atoi(matches[3])
	if err != nil {
		return dockerSemver{}, false
	}
	return dockerSemver{Major: major, Minor: minor, Patch: patch}, true
}

func compareDockerSemver(left dockerSemver, right dockerSemver) int {
	switch {
	case left.Major != right.Major:
		return left.Major - right.Major
	case left.Minor != right.Minor:
		return left.Minor - right.Minor
	default:
		return left.Patch - right.Patch
	}
}

func splitDockerRepository(repository string) (string, string, error) {
	parts := strings.Split(repository, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", fmt.Errorf("invalid docker repository %q, expected namespace/name", repository)
	}
	return parts[0], parts[1], nil
}

func buildDockerHubTagURL(repository string, tag string) string {
	if repository == "" {
		return ""
	}
	if tag == "" {
		return fmt.Sprintf("https://hub.docker.com/repository/docker/%s", repository)
	}
	return fmt.Sprintf("https://hub.docker.com/repository/docker/%s/tags?name=%s", repository, url.QueryEscape(tag))
}
