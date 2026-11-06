package githubcopilot

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const loginTimeout = 15 * time.Minute

var deviceChallengePattern = regexp.MustCompile(`(?i)visit\s+(https://[^\s]+/login/device)\s+and enter code\s+([A-Z0-9]{4}-[A-Z0-9]{4})`)

type LoginState struct {
	ID              string `json:"id"`
	ProfileID       string `json:"profile_id"`
	Login           string `json:"login,omitempty"`
	Authenticated   bool   `json:"authenticated"`
	Status          string `json:"status"`
	VerificationURL string `json:"verification_url,omitempty"`
	UserCode        string `json:"user_code,omitempty"`
	ExpiresAt       int64  `json:"expires_at"`
	Message         string `json:"message,omitempty"`
}

type loginAttempt struct {
	mu     sync.Mutex
	state  LoginState
	cmd    *exec.Cmd
	cancel context.CancelFunc
}

var loginAttempts sync.Map

func StartLogin() (LoginState, error) {
	if err := ensureRuntimeDirs(); err != nil {
		return LoginState{}, err
	}
	profileID := uuid.NewString()
	dir, err := profileDir(profileID)
	if err != nil {
		return LoginState{}, err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return LoginState{}, fmt.Errorf("create Copilot profile directory: %w", err)
	}
	attempt := &loginAttempt{
		state: LoginState{
			ID:        profileID,
			ProfileID: profileID,
			Status:    "starting",
			ExpiresAt: time.Now().Add(loginTimeout).Unix(),
		},
	}
	loginAttempts.Store(profileID, attempt)
	go attempt.run(profileID, dir)
	return attempt.snapshot(), nil
}

func (a *loginAttempt) snapshot() LoginState {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.state
}

func (a *loginAttempt) setState(update func(*LoginState)) {
	a.mu.Lock()
	defer a.mu.Unlock()
	update(&a.state)
}

func (a *loginAttempt) run(profileID, dir string) {
	ctx, cancel := context.WithTimeout(context.Background(), loginTimeout)
	a.mu.Lock()
	a.cancel = cancel
	a.mu.Unlock()
	defer cancel()
	path, err := cliPath()
	if err != nil {
		a.fail(err)
		return
	}
	cmd := exec.CommandContext(ctx, path, "--no-auto-update", "login", "--device-code")
	cmd.Dir = workDir()
	cmd.Env = isolatedEnvironment(dir)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		a.fail(fmt.Errorf("open Copilot login output: %w", err))
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		a.fail(fmt.Errorf("open Copilot login output: %w", err))
		return
	}
	if err := cmd.Start(); err != nil {
		a.fail(fmt.Errorf("start GitHub Copilot login: %w", err))
		return
	}
	a.mu.Lock()
	a.cmd = cmd
	if a.state.Status == "starting" {
		a.state.Status = "waiting"
	}
	a.mu.Unlock()
	var readers sync.WaitGroup
	readers.Add(2)
	read := func(scanner *bufio.Scanner) {
		defer readers.Done()
		scanner.Buffer(make([]byte, 64<<10), 1<<20)
		for scanner.Scan() {
			a.observeOutput(scanner.Text())
		}
	}
	go read(bufio.NewScanner(stdout))
	go read(bufio.NewScanner(stderr))
	waitErr := cmd.Wait()
	readers.Wait()

	status := a.snapshot()
	if status.Status == "cancelled" || status.Status == "connected" {
		return
	}
	if ctx.Err() != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			a.setState(func(state *LoginState) {
				state.Status = "expired"
				state.Message = "The GitHub device code expired. Start the connection again."
			})
		}
		_ = os.RemoveAll(dir)
		return
	}
	if waitErr != nil {
		a.fail(errors.New("GitHub sign-in did not complete. Retry the connection"))
		return
	}
	checkCtx, checkCancel := context.WithTimeout(context.Background(), rpcTimeout)
	defer checkCancel()
	identity, err := AuthStatusForProfile(checkCtx, profileID)
	if err != nil || !identity.IsAuthenticated || strings.TrimSpace(identity.Login) == "" {
		a.fail(errors.New("GitHub sign-in completed but the Copilot profile is not authenticated"))
		return
	}
	a.setState(func(state *LoginState) {
		state.Status = "connected"
		state.Login = identity.Login
		state.Authenticated = true
		state.Message = ""
	})
}

func (a *loginAttempt) observeOutput(text string) {
	matches := deviceChallengePattern.FindStringSubmatch(text)
	if len(matches) != 3 {
		return
	}
	verificationURL := strings.TrimSpace(matches[1])
	parsed, err := url.Parse(verificationURL)
	if err != nil || parsed.Host == "" || parsed.User != nil {
		return
	}
	userCode := strings.ToUpper(strings.TrimSpace(matches[2]))
	a.setState(func(state *LoginState) {
		if state.Status == "connected" || state.Status == "cancelled" || state.Status == "failed" || state.Status == "expired" {
			return
		}
		state.Status = "waiting"
		state.VerificationURL = verificationURL
		state.UserCode = userCode
	})
}

func (a *loginAttempt) fail(err error) {
	a.mu.Lock()
	profileID := a.state.ProfileID
	a.mu.Unlock()
	StopProfile(profileID)
	a.setState(func(state *LoginState) {
		if state.Status == "connected" || state.Status == "cancelled" {
			return
		}
		state.Status = "failed"
		state.Message = err.Error()
	})
	if dir, pathErr := profileDir(profileID); pathErr == nil {
		_ = os.RemoveAll(dir)
	}
}

func GetLoginState(id string) (LoginState, error) {
	attempt, ok := loginAttempts.Load(strings.TrimSpace(id))
	if !ok {
		return LoginState{}, errors.New("Copilot login attempt was not found")
	}
	state := attempt.(*loginAttempt).snapshot()
	if (state.Status == "starting" || state.Status == "waiting") && state.ExpiresAt > 0 && time.Now().Unix() >= state.ExpiresAt {
		state.Status = "expired"
		state.Message = "The GitHub device code expired. Start the connection again."
	}
	return state, nil
}

func CancelLogin(id string) (LoginState, error) {
	attemptValue, ok := loginAttempts.Load(strings.TrimSpace(id))
	if !ok {
		return LoginState{}, errors.New("Copilot login attempt was not found")
	}
	attempt := attemptValue.(*loginAttempt)
	attempt.mu.Lock()
	if attempt.state.Status == "connected" {
		state := attempt.state
		attempt.mu.Unlock()
		return state, errors.New("Copilot login already completed")
	}
	attempt.state.Status = "cancelled"
	attempt.state.Message = "GitHub connection cancelled"
	cancel := attempt.cancel
	cmd := attempt.cmd
	profileID := attempt.state.ProfileID
	state := attempt.state
	attempt.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
	StopProfile(profileID)
	if dir, err := profileDir(profileID); err == nil {
		_ = os.RemoveAll(dir)
	}
	return state, nil
}
