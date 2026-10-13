package config

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strconv"
	"time"
)

const minimumSigningKeyBytes = 32

type Config struct {
	ListenAddress        string
	DatabasePath         string
	SigningKey           []byte
	SnapshotTTL          time.Duration
	HysteresisMicrounits int64
	AllowNonLoopback     bool
}

func Load(lookup func(string) string) (Config, error) {
	configuration := Config{
		ListenAddress: "127.0.0.1:8080",
		DatabasePath:  "smart-router.db",
		SnapshotTTL:   5 * time.Minute,
	}
	if value := lookup("SMART_ROUTER_LISTEN"); value != "" {
		configuration.ListenAddress = value
	}
	if value := lookup("SMART_ROUTER_DATABASE"); value != "" {
		configuration.DatabasePath = value
	}
	if value := lookup("SMART_ROUTER_SNAPSHOT_TTL"); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return Config{}, errors.New("SMART_ROUTER_SNAPSHOT_TTL is invalid")
		}
		configuration.SnapshotTTL = duration
	}
	if value := lookup("SMART_ROUTER_HYSTERESIS_MICROUNITS"); value != "" {
		hysteresis, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return Config{}, errors.New("SMART_ROUTER_HYSTERESIS_MICROUNITS is invalid")
		}
		configuration.HysteresisMicrounits = hysteresis
	}
	if value := lookup("SMART_ROUTER_ALLOW_NON_LOOPBACK"); value != "" {
		allow, err := strconv.ParseBool(value)
		if err != nil {
			return Config{}, errors.New("SMART_ROUTER_ALLOW_NON_LOOPBACK is invalid")
		}
		configuration.AllowNonLoopback = allow
	}
	configuration.SigningKey = []byte(lookup("SMART_ROUTER_SIGNING_KEY"))
	if err := configuration.Validate(); err != nil {
		return Config{}, err
	}
	return configuration, nil
}

func (configuration Config) Validate() error {
	host, _, err := net.SplitHostPort(configuration.ListenAddress)
	if err != nil {
		return errors.New("SMART_ROUTER_LISTEN must be a host:port address")
	}
	ip := net.ParseIP(host)
	if !configuration.AllowNonLoopback &&
		host != "localhost" &&
		(ip == nil || !ip.IsLoopback()) {
		return errors.New("SMART_ROUTER_LISTEN must use a loopback host")
	}
	if configuration.DatabasePath == "" {
		return errors.New("SMART_ROUTER_DATABASE must not be empty")
	}
	if len(configuration.SigningKey) < minimumSigningKeyBytes {
		return fmt.Errorf(
			"SMART_ROUTER_SIGNING_KEY must contain at least %d bytes",
			minimumSigningKeyBytes,
		)
	}
	if configuration.SnapshotTTL <= 0 || configuration.SnapshotTTL > 24*time.Hour {
		return errors.New("SMART_ROUTER_SNAPSHOT_TTL must be between zero and 24h")
	}
	if configuration.HysteresisMicrounits < 0 {
		return errors.New("SMART_ROUTER_HYSTERESIS_MICROUNITS must not be negative")
	}
	return nil
}

func (configuration Config) PublicHashes() (string, string, error) {
	publicConfig := struct {
		ListenAddress        string `json:"listen_address"`
		DatabasePath         string `json:"database_path"`
		SnapshotTTLMS        int64  `json:"snapshot_ttl_ms"`
		HysteresisMicrounits int64  `json:"hysteresis_microunits"`
		AllowNonLoopback     bool   `json:"allow_non_loopback"`
	}{
		ListenAddress:        configuration.ListenAddress,
		DatabasePath:         configuration.DatabasePath,
		SnapshotTTLMS:        configuration.SnapshotTTL.Milliseconds(),
		HysteresisMicrounits: configuration.HysteresisMicrounits,
		AllowNonLoopback:     configuration.AllowNonLoopback,
	}
	configPayload, err := json.Marshal(publicConfig)
	if err != nil {
		return "", "", err
	}
	pluginPayload, err := json.Marshal([]string{"ebond", "hualong", "leyi"})
	if err != nil {
		return "", "", err
	}
	return sha256Hex(configPayload), sha256Hex(pluginPayload), nil
}

func sha256Hex(payload []byte) string {
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}
