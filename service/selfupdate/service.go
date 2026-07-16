package selfupdate

import (
	"context"
	"errors"
	"os"
	"runtime"
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
	Message         string
	NeedRestart     bool
	AlreadyUpToDate bool
	DeployMode      DeployMode
	FromVersion     string
	ToVersion       string
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

	rel, err := s.gh.FetchLatestRelease(ctx, s.cfg.Repo)
	if err != nil {
		return nil, err
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

	// Docker capability.
	var dockerCap DockerCapability
	if dockerEng != nil {
		// Injected engine: probe via Ping + InspectSelf.
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
	} else {
		// Production path: dial real socket.
		dockerCap = ProbeDocker(ctx, s.cfg.DockerHost, s.cfg.DockerImage)
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
		Cached:         false,
	}

	globalCache.set(info)
	return info, nil
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

		image := info.Docker.Image
		if image == "" {
			image = s.cfg.DockerImage
		}

		eng := s.docker
		if eng == nil {
			eng, err = NewDockerEngine(s.cfg.DockerHost)
			if err != nil {
				s.setStatus(PhaseFailed, "create docker engine failed", false, err.Error())
				return nil, err
			}
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

		// Container is replaced; process will die momentarily.
		s.setStatus(PhaseDone, "docker update complete; container recreated", false, "")
		return &PerformResult{
			Message:     "docker update complete; container recreated",
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
