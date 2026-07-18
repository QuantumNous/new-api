package selfupdate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Sentinel errors.
var (
	ErrUpdateInProgress = errors.New("update already in progress")
	ErrUpdateDisabled   = errors.New("self-update is disabled")
)

// PerformResult is returned by Service.Perform.
type PerformResult struct {
	Message         string     `json:"message"`
	NeedRestart     bool       `json:"need_restart"`
	AlreadyUpToDate bool       `json:"already_up_to_date"`
	DeployMode      DeployMode `json:"deploy_mode"`
	FromVersion     string     `json:"from_version,omitempty"`
	ToVersion       string     `json:"to_version,omitempty"`
}

// Phase constants for Status.Phase.
const (
	PhaseIdle     = "idle"
	PhaseChecking = "checking"
	PhasePulling  = "pulling"
	PhaseApplying = "applying"
	PhaseDone     = "done"
	PhaseFailed   = "failed"
)

// Service is the self-update facade.
type Service struct {
	cfg            Config
	gh             GitHubClient
	docker         DockerEngine // nil until first docker perform
	currentVersion string

	mu     sync.Mutex
	locked bool // true while Perform is running
	status Status
}

// Default returns the package-level singleton Service, constructed lazily.
var (
	defaultOnce    sync.Once
	defaultService *Service
)

func Default() *Service {
	defaultOnce.Do(func() {
		cfg := LoadConfig()
		gh := NewHTTPGitHubClient(cfg.GitHubToken, nil)
		defaultService = &Service{
			cfg:            cfg,
			gh:             gh,
			currentVersion: common.Version,
			status:         Status{Phase: PhaseIdle},
		}
	})
	return defaultService
}

// newService creates a Service for testing, with injectable dependencies.
func newService(cfg Config, gh GitHubClient, docker DockerEngine, currentVersion string) *Service {
	return &Service{
		cfg:            cfg,
		gh:             gh,
		docker:         docker,
		currentVersion: currentVersion,
		status:         Status{Phase: PhaseIdle},
	}
}

// Status returns the current update status.
func (s *Service) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

func (s *Service) setStatus(phase, message string, updating bool, err string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = Status{
		Phase:     phase,
		Message:   message,
		Updating:  updating,
		Error:     err,
		UpdatedAt: time.Now().Unix(),
	}
}

// Check fetches (or returns cached) update information.
// If force is true the cache is bypassed.
// Docker is probed via ProbeDocker (real socket).
func (s *Service) Check(ctx context.Context, force bool) (*Info, error) {
	return s.check(ctx, force, nil)
}

// check is the internal implementation. When dockerEng is non-nil it is used
// to populate the DockerCapability instead of calling ProbeDocker, which
// lets tests inject a fake engine without hitting a real socket.
func (s *Service) check(ctx context.Context, force bool, dockerEng DockerEngine) (*Info, error) {
	if !s.cfg.Enabled {
		return &Info{
			Enabled:        false,
			CurrentVersion: s.currentVersion,
			DeployMode:     DetectDeployMode(),
		}, nil
	}

	mode := DetectDeployMode()

	if !force {
		if cached := globalCache.get(s.cfg.CacheTTL); cached != nil {
			info := *cached
			info.Cached = true
			return &info, nil
		}
	}

	// Docker capability (always probe so UI can show sock status even when
	// GitHub has no releases).
	dockerCap := s.probeDockerCap(ctx, dockerEng)

	rel, err := s.gh.FetchLatestRelease(ctx, s.cfg.Repo)
	if err != nil {
		// No releases published on the fork → treat as already up to date.
		if errors.Is(err, ErrNoReleases) {
			info := s.upToDateInfo(mode, &dockerCap, "")
			globalCache.set(info)
			return info, nil
		}
		// Prefer stale cache with a warning over hard failure.
		if cached := globalCache.get(s.cfg.CacheTTL * 24); cached != nil {
			info := *cached
			info.Cached = true
			info.Warning = err.Error()
			info.DeployMode = mode
			info.Docker = &dockerCap
			return &info, nil
		}
		// Soft-fail: do not break the maintenance page; report no update.
		info := s.upToDateInfo(mode, &dockerCap, err.Error())
		return info, nil
	}

	hasUpdate := CompareVersions(s.currentVersion, rel.TagName) < 0

	// Binary capability.
	binCap := &BinaryCapability{
		Platform: runtime.GOOS + "/" + runtime.GOARCH,
	}
	_, _, assetErr := SelectBinaryAsset(rel.Assets, runtime.GOOS, runtime.GOARCH)
	if assetErr == nil {
		binCap.AssetFound = true
	} else {
		binCap.Reason = assetErr.Error()
	}

	info := &Info{
		Enabled:        true,
		DeployMode:     mode,
		CurrentVersion: s.currentVersion,
		LatestVersion:  rel.TagName,
		HasUpdate:      hasUpdate,
		Release:        rel,
		Binary:         binCap,
		Docker:         &dockerCap,
		UpdateSource:   s.cfg.Repo,
		Cached:         false,
	}

	globalCache.set(info)
	return info, nil
}

// upToDateInfo builds a successful Check payload with has_update=false.
func (s *Service) upToDateInfo(mode DeployMode, dockerCap *DockerCapability, warning string) *Info {
	binCap := &BinaryCapability{
		Platform: runtime.GOOS + "/" + runtime.GOARCH,
	}
	return &Info{
		Enabled:        true,
		DeployMode:     mode,
		CurrentVersion: s.currentVersion,
		LatestVersion:  s.currentVersion,
		HasUpdate:      false,
		Binary:         binCap,
		Docker:         dockerCap,
		UpdateSource:   s.cfg.Repo,
		Cached:         false,
		Warning:        warning,
	}
}

func (s *Service) probeDockerCap(ctx context.Context, dockerEng DockerEngine) DockerCapability {
	var dockerCap DockerCapability
	if dockerEng != nil {
		if pingErr := dockerEng.Ping(ctx); pingErr != nil {
			dockerCap.Reason = "socket unavailable: " + pingErr.Error()
		} else {
			dockerCap.SocketAvailable = true
			if ci, inspErr := dockerEng.InspectSelf(ctx); inspErr == nil {
				dockerCap.ContainerID = ci.ID
				if s.cfg.DockerImage != "" {
					dockerCap.Image = s.cfg.DockerImage
				} else {
					dockerCap.Image = ci.Config.Image
				}
			}
		}
		return dockerCap
	}
	return ProbeDocker(ctx, s.cfg.DockerHost, s.cfg.DockerImage)
}

// Perform runs the update. It acquires a single-flight lock; a second
// concurrent call returns ErrUpdateInProgress immediately.
func (s *Service) Perform(ctx context.Context) (*PerformResult, error) {
	if !s.cfg.Enabled {
		return nil, ErrUpdateDisabled
	}

	// Acquire single-flight lock.
	s.mu.Lock()
	if s.locked {
		s.mu.Unlock()
		return nil, ErrUpdateInProgress
	}
	s.locked = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.locked = false
		s.mu.Unlock()
	}()

	s.setStatus(PhaseChecking, "checking for updates", true, "")

	// force=true on the GH side, but we still use a cached docker probe if
	// an injected engine is present (avoids hitting a real socket in tests).
	info, err := s.check(ctx, true, s.docker)
	if err != nil {
		s.setStatus(PhaseFailed, "check failed", false, err.Error())
		return nil, err
	}

	if !info.HasUpdate {
		s.setStatus(PhaseIdle, "already up to date", false, "")
		return &PerformResult{
			Message:         "already up to date",
			AlreadyUpToDate: true,
			DeployMode:      info.DeployMode,
			FromVersion:     s.currentVersion,
			ToVersion:       info.LatestVersion,
		}, nil
	}

	mode := info.DeployMode

	switch mode {
	case DeployModeBinary:
		s.setStatus(PhaseApplying, "applying binary update", true, "")
		if err := ApplyBinaryUpdate(ctx, s.gh, info.Release, runtime.GOOS, runtime.GOARCH); err != nil {
			if errors.Is(err, ErrAlreadyUpToDate) {
				s.setStatus(PhaseIdle, "already up to date", false, "")
				return &PerformResult{
					Message:         "already up to date",
					AlreadyUpToDate: true,
					DeployMode:      mode,
					FromVersion:     s.currentVersion,
					ToVersion:       info.LatestVersion,
				}, nil
			}
			s.setStatus(PhaseFailed, "binary update failed", false, err.Error())
			return nil, err
		}
		s.setStatus(PhaseDone, "binary update applied; restart required", false, "")
		return &PerformResult{
			Message:     "binary update applied; restart required",
			NeedRestart: true,
			DeployMode:  mode,
			FromVersion: s.currentVersion,
			ToVersion:   info.LatestVersion,
		}, nil

	case DeployModeDocker:
		if info.Docker == nil || !info.Docker.SocketAvailable {
			reason := "docker socket unavailable"
			if info.Docker != nil && info.Docker.Reason != "" {
				reason = info.Docker.Reason
			}
			s.setStatus(PhaseFailed, reason, false, reason)
			return nil, errors.New(reason)
		}

		eng := s.docker
		if eng == nil {
			eng, err = NewDockerEngine(s.cfg.DockerHost)
			if err != nil {
				s.setStatus(PhaseFailed, "create docker engine failed", false, err.Error())
				return nil, err
			}
		}

		// When the GitHub Release has downloadable assets, install from GitHub
		// into a local image (works for private/local Docker deploys).
		if info.Release != nil && len(info.Release.Assets) > 0 {
			s.setStatus(PhasePulling, "downloading release binary for docker update", true, "")
			if err := s.applyDockerFromGitHub(ctx, eng, info); err != nil {
				s.setStatus(PhaseFailed, "docker github update failed", false, err.Error())
				return nil, err
			}
			s.setStatus(PhaseDone, "docker update scheduled; container recreation in progress", false, "")
			return &PerformResult{
				Message:     "docker update scheduled; container recreation in progress",
				NeedRestart: false,
				DeployMode:  mode,
				FromVersion: s.currentVersion,
				ToVersion:   info.LatestVersion,
			}, nil
		}

		// Fallback: pull registry image (legacy path).
		image := info.Docker.Image
		if image == "" {
			image = s.cfg.DockerImage
		}

		s.setStatus(PhasePulling, "pulling new image", true, "")
		if err := eng.PullImage(ctx, image); err != nil {
			s.setStatus(PhaseFailed, "pull image failed", false, err.Error())
			return nil, err
		}

		s.setStatus(PhaseApplying, "recreating container", true, "")
		if err := eng.RecreateSelf(ctx, image); err != nil {
			if errors.Is(err, ErrAlreadyUpToDate) {
				s.setStatus(PhaseIdle, "already up to date", false, "")
				return &PerformResult{
					Message:         "already up to date",
					AlreadyUpToDate: true,
					DeployMode:      mode,
					FromVersion:     s.currentVersion,
					ToVersion:       info.LatestVersion,
				}, nil
			}
			s.setStatus(PhaseFailed, "recreate container failed", false, err.Error())
			return nil, err
		}

		// The helper will replace this container after the response is returned.
		s.setStatus(PhaseDone, "docker update scheduled; container recreation in progress", false, "")
		return &PerformResult{
			Message:     "docker update scheduled; container recreation in progress",
			NeedRestart: false,
			DeployMode:  mode,
			FromVersion: s.currentVersion,
			ToVersion:   info.LatestVersion,
		}, nil

	default:
		s.setStatus(PhaseFailed, "unknown deploy mode", false, "unknown deploy mode: "+string(mode))
		return nil, errors.New("unknown deploy mode: " + string(mode))
	}
}

// dockerLocalImageRef builds the local image name for a release tag.
func dockerLocalImageRef(version string) string {
	v := strings.TrimSpace(version)
	if v == "" {
		v = "latest"
	}
	return "local/new-api:" + v
}

// applyDockerFromGitHub downloads the linux binary from the release, builds a
// local image local/new-api:{tag}, and schedules the current container replacement.
func (s *Service) applyDockerFromGitHub(ctx context.Context, eng DockerEngine, info *Info) error {
	goos, goarch := "linux", runtime.GOARCH
	if goarch == "" {
		goarch = "amd64"
	}

	binAsset, sumAsset, err := SelectBinaryAsset(info.Release.Assets, goos, goarch)
	if err != nil {
		return fmt.Errorf("select release asset: %w", err)
	}
	if sumAsset == nil {
		return fmt.Errorf("no checksum asset for %s/%s; update rejected", goos, goarch)
	}

	tmpDir, err := os.MkdirTemp("", "new-api-docker-update-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	binPath := filepath.Join(tmpDir, binAsset.Name)
	maxSize := binAsset.Size
	if maxSize <= 0 {
		maxSize = defaultMaxDownload
	} else {
		maxSize += 1 << 20
	}
	if err := s.gh.Download(ctx, binAsset.DownloadURL, binPath, maxSize); err != nil {
		return fmt.Errorf("download binary: %w", err)
	}

	sumData, err := s.gh.FetchBytes(ctx, sumAsset.DownloadURL, 1<<20)
	if err != nil {
		return fmt.Errorf("fetch checksum: %w", err)
	}
	wantHex, err := ParseChecksumFile(sumData, binAsset.Name)
	if err != nil {
		return fmt.Errorf("parse checksum: %w", err)
	}
	gotHex, err := fileSHA256Hex(binPath)
	if err != nil {
		return err
	}
	if !strings.EqualFold(gotHex, wantHex) {
		return fmt.Errorf("checksum mismatch: want %s got %s", wantHex, gotHex)
	}

	ci, err := eng.InspectSelf(ctx)
	if err != nil {
		return fmt.Errorf("inspect self: %w", err)
	}
	baseImage := ci.Image
	if baseImage == "" {
		baseImage = ci.Config.Image
	}
	if baseImage == "" {
		baseImage = "calciumion/new-api:latest"
	}

	targetImage := dockerLocalImageRef(info.LatestVersion)
	s.setStatus(PhaseApplying, "building local image from release binary", true, "")
	if err := eng.BuildImageWithBinary(ctx, baseImage, binPath, targetImage); err != nil {
		return err
	}
	s.setStatus(PhaseApplying, "recreating container onto "+targetImage, true, "")
	return eng.RecreateSelfLocal(ctx, targetImage)
}

func fileSHA256Hex(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// Restart schedules a graceful process exit after 500ms (binary mode only).
// For Docker mode it returns an error — the container restart is handled by
// Perform (RecreateSelf). Callers must ensure a process manager (systemd,
// Docker restart policy, etc.) will restart the process.
func (s *Service) Restart(_ context.Context) error {
	mode := DetectDeployMode()
	if mode == DeployModeDocker {
		return errors.New("docker mode: use update recreate instead of restart")
	}
	go func() {
		time.Sleep(500 * time.Millisecond)
		os.Exit(0)
	}()
	return nil
}
