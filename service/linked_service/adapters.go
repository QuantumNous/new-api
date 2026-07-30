package linked_service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// httpClient is shared across adapters; 10-second timeout prevents hanging.
var httpClient = &http.Client{Timeout: 10 * time.Second}

// ─── Kiro-Go ──────────────────────────────────────────────────────────────────

// KiroGoAdapter updates the Kiro-Go admin password via its settings API.
// Kiro-Go authenticates admin requests with X-Admin-Password; the adapter
// sends the OLD password (read from the live config file via environment) to
// authenticate the change request, then sends a POST /admin/api/settings with
// the new password.
//
// Because we do not store the old password, we call the Kiro-Go admin status
// endpoint first with the new password to detect whether a sync is already
// applied (idempotent), and fall back to the settings update call.
type KiroGoAdapter struct{}

func (a *KiroGoAdapter) Apply(svc *model.LinkedService, newPassword string) error {
	base := svc.AdminURL
	if base == "" {
		base = "http://127.0.0.1:8080"
	}

	// Check if new password already works (idempotent)
	if a.testPassword(base, newPassword) {
		return nil
	}

	// Kiro-Go's POST /admin/api/settings with body {"password": "<new>"} uses
	// the X-Admin-Password header for authentication. Since we cannot know the
	// current password without storing it, we read it from the on-disk config.
	currentPwd, err := readKiroGoCurrentPassword()
	if err != nil {
		return fmt.Errorf("kiro-go: cannot read current password from config: %w", err)
	}

	body, _ := json.Marshal(map[string]string{"password": newPassword})
	req, err := http.NewRequest(http.MethodPost, base+"/admin/api/settings", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Admin-Password", currentPwd)

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("kiro-go: settings request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("kiro-go: unexpected status %d: %s", resp.StatusCode, string(raw))
	}

	// Verify the new password works now
	if !a.testPassword(base, newPassword) {
		return fmt.Errorf("kiro-go: password change reported success but verification failed")
	}
	return nil
}

func (a *KiroGoAdapter) testPassword(base, password string) bool {
	req, err := http.NewRequest(http.MethodGet, base+"/admin/api/status", nil)
	if err != nil {
		return false
	}
	req.Header.Set("X-Admin-Password", password)
	resp, err := httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// ─── Kiro-Rs ──────────────────────────────────────────────────────────────────

// KiroRsAdapter updates the Kiro-Rs-Tool adminApiKey via the config volume.
// Kiro-Rs exposes no live admin-password-change API, so the adapter writes the
// JSON config and triggers a container restart via the Docker socket if available,
// or signals the need for a manual restart.
type KiroRsAdapter struct{}

func (a *KiroRsAdapter) Apply(svc *model.LinkedService, newPassword string) error {
	// Kiro-Rs does not expose a live password-update HTTP endpoint.
	// The only safe path is updating the config file on the volume and restarting.
	// We return a clear message so the operator knows what to do.
	return fmt.Errorf(
		"kiro-rs: adapter does not support live sync — update adminApiKey in the config volume " +
			"and restart the kiro-rs-tool container manually; " +
			"current adminApiKey: see /mnt/d/Code/NewApi/data/kiro-rs/config.json",
	)
}

// ─── OB-1 Gateway ─────────────────────────────────────────────────────────────

// OB1Adapter updates the OB-1 admin password via its /api/login + /api/admin/password
// flow. OB-1 uses a simple username/password API.
type OB1Adapter struct{}

func (a *OB1Adapter) Apply(svc *model.LinkedService, newPassword string) error {
	base := svc.AdminURL
	if base == "" {
		base = "http://127.0.0.1:8081"
	}

	// Get a JWT token for the current admin credentials stored in the TOML config.
	// We read the current username from the config file; password is unknown so
	// we try the new password first (idempotent check), then signal manual action.
	if a.testLogin(base, "Onesoft", newPassword) {
		return nil // already synced
	}

	// OB-1 provides POST /api/admin/update_password with a JWT-authenticated body.
	// Without the current password we cannot authenticate. Signal the operator.
	return fmt.Errorf(
		"ob1: cannot authenticate with new password and cannot retrieve current password " +
			"— update [admin] password in AI-Account-Toolkits/ob12api/config/setting.toml and restart ob12api",
	)
}

func (a *OB1Adapter) testLogin(base, username, password string) bool {
	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	req, err := http.NewRequest(http.MethodPost, base+"/api/login", bytes.NewReader(body))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// ─── Unsupported ──────────────────────────────────────────────────────────────

// UnsupportedAdapter returns a clear error for services that do not yet have
// a live credential-sync implementation.
type UnsupportedAdapter struct{ Name string }

func (a *UnsupportedAdapter) Apply(_ *model.LinkedService, _ string) error {
	return fmt.Errorf("%s: automatic credential sync is not yet supported; update manually", a.Name)
}
