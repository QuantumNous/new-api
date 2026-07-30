package linked_service

import (
	"encoding/json"
	"fmt"
	"os"
)

const kiroGoConfigPath = "/mnt/d/Code/NewApi/data/kiro-go/config.json"

type kiroGoConfig struct {
	Password string `json:"password"`
}

// readKiroGoCurrentPassword reads the admin password from the Kiro-Go
// bind-mounted config file. This is needed so the adapter can authenticate
// the settings-update HTTP request with the *current* password.
func readKiroGoCurrentPassword() (string, error) {
	data, err := os.ReadFile(kiroGoConfigPath)
	if err != nil {
		return "", fmt.Errorf("reading %s: %w", kiroGoConfigPath, err)
	}
	var cfg kiroGoConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", fmt.Errorf("parsing %s: %w", kiroGoConfigPath, err)
	}
	if cfg.Password == "" {
		return "", fmt.Errorf("password field is empty in %s", kiroGoConfigPath)
	}
	return cfg.Password, nil
}
