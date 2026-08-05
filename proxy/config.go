package main

import (
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config is the on-disk configuration of the prompt audit proxy.
type Config struct {
	Listen   string `yaml:"listen"`
	Upstream string `yaml:"upstream"`
	NodeName string `yaml:"node_name"`

	// Debug logs one line per relay request as it enters the proxy and one when
	// its audit record is enqueued. It is the only way to tell "the request never
	// reached the audited branch" apart from "the record was produced and lost".
	Debug bool `yaml:"debug"`

	// FailOpen decides what happens when auditing cannot be guaranteed.
	//
	//	true  (default) — availability first: the proxy starts even when the audit
	//	                  database is unreachable, and relay traffic is never
	//	                  rejected because of auditing. Records that cannot be
	//	                  written go to the spool directory.
	//	false           — compliance first ("no audit, no service"): the proxy
	//	                  refuses to start without a working audit database, and
	//	                  returns 503 instead of forwarding when the in-memory
	//	                  audit buffer is saturated.
	FailOpen *bool `yaml:"fail_open"`

	Database DatabaseConfig `yaml:"database"`
	Capture  CaptureConfig  `yaml:"capture"`
	Store    StoreConfig    `yaml:"store"`
	Identity IdentityConfig `yaml:"identity"`

	// sourcePath and envOverrides record where the effective values came from, so
	// startup can report it. An environment variable silently winning over the
	// mounted file is otherwise invisible and very expensive to debug.
	sourcePath   string
	envOverrides []string
}

type DatabaseConfig struct {
	// Driver is one of mysql, postgres, sqlite.
	Driver string `yaml:"driver"`
	DSN    string `yaml:"dsn"`
	// AutoMigrate lets the proxy create and update prompt_audit_logs itself
	// (default). Turn it off where an application must not run DDL against the
	// database — a shared production database being the usual case: pre-create the
	// table with the DDL in schema/ and give the proxy an account holding only
	// INSERT on it (plus SELECT on tokens and users if identity lookup is on).
	AutoMigrate *bool `yaml:"auto_migrate"`
}

func (d DatabaseConfig) autoMigrate() bool {
	return d.AutoMigrate == nil || *d.AutoMigrate
}

type CaptureConfig struct {
	// Paths lists the request paths to audit. A trailing "*" matches any suffix.
	Paths []string `yaml:"paths"`
	// MaxBodyBytes bounds how many request-body bytes are buffered for
	// extraction. Larger bodies still stream through untouched; only the first
	// MaxBodyBytes are inspected and the record is marked truncated.
	MaxBodyBytes    int64 `yaml:"max_body_bytes"`
	StorePromptText bool  `yaml:"store_prompt_text"`
	StoreRawBody    bool  `yaml:"store_raw_body"`
	// PromptScope selects how much of the request is kept: last_user, user_only
	// or all. See the Prompt scope constants for why this matters.
	PromptScope string `yaml:"prompt_scope"`
	// MaxPromptBytes and MaxRawBodyBytes are byte limits, not character limits,
	// because that is what the database column enforces. See textColumnSafeBytes.
	MaxPromptBytes  int      `yaml:"max_prompt_bytes"`
	MaxRawBodyBytes int      `yaml:"max_raw_body_bytes"`
	RedactPatterns  []string `yaml:"redact_patterns"`
}

// textColumnSafeBytes bounds any value stored in a TEXT column. MySQL's TEXT
// holds 65535 bytes; PostgreSQL and SQLite are unbounded, but one cap keeps the
// schema portable and — more importantly — stops a single oversized prompt from
// failing its insert. The headroom absorbs the truncation marker and multi-byte
// backoff.
const textColumnSafeBytes = 60000

// minTextBytes keeps a configured cap large enough to be useful.
const minTextBytes = 256

type StoreConfig struct {
	BufferSize        int    `yaml:"buffer_size"`
	BatchSize         int    `yaml:"batch_size"`
	FlushIntervalMs   int    `yaml:"flush_interval_ms"`
	SpoolDir          string `yaml:"spool_dir"`
	SpoolReplaySecond int    `yaml:"spool_replay_seconds"`
}

type IdentityConfig struct {
	// Enabled turns on token -> user resolution by reading new-api's tokens and
	// users tables. Disable it to keep the audit database fully decoupled.
	Enabled         bool `yaml:"enabled"`
	CacheTTLSeconds int  `yaml:"cache_ttl_seconds"`
	CacheSize       int  `yaml:"cache_size"`
}

// defaultCapturePaths covers every relay endpoint that carries a user prompt in
// a JSON body. Multipart audio endpoints are deliberately excluded: their bodies
// are binary and carry no prompt text.
var defaultCapturePaths = []string{
	"/v1/chat/completions",
	"/v1/completions",
	"/v1/messages",
	"/v1/responses",
	"/v1/responses/compact",
	"/v1/embeddings",
	"/v1/rerank",
	"/v1/moderations",
	"/v1/images/generations",
	"/v1/images/edits",
	"/v1/edits",
	"/v1/alpha/search",
	"/v1beta/models/*",
	"/v1/models/*",
	"/pg/chat/completions",
}

func LoadConfig(path string) (*Config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}
	cfg := &Config{}
	if err := yaml.Unmarshal(raw, cfg); err != nil {
		return nil, fmt.Errorf("parse config %s: %w", path, err)
	}

	// Environment overrides keep secrets out of the mounted config file. They win
	// over the file, so every one that fires is recorded and reported at startup.
	cfg.sourcePath = path
	for _, override := range []struct {
		env    string
		target *string
	}{
		{"PROXY_LISTEN", &cfg.Listen},
		{"PROXY_UPSTREAM", &cfg.Upstream},
		{"PROXY_DB_DRIVER", &cfg.Database.Driver},
		{"PROXY_DB_DSN", &cfg.Database.DSN},
		{"PROXY_NODE_NAME", &cfg.NodeName},
	} {
		if v := os.Getenv(override.env); v != "" {
			*override.target = v
			cfg.envOverrides = append(cfg.envOverrides, override.env)
		}
	}

	cfg.applyDefaults()
	return cfg, cfg.validate()
}

// LogEffective reports the configuration the process actually runs with. Without
// this, a stale config file or an unnoticed environment override looks identical
// to a bug in the audit pipeline.
func (c *Config) LogEffective() {
	log.Printf("proxy: config file      = %s", c.sourcePath)
	if len(c.envOverrides) > 0 {
		log.Printf("proxy: OVERRIDDEN by env = %s", strings.Join(c.envOverrides, ", "))
	}
	log.Printf("proxy: listen           = %s", c.Listen)
	log.Printf("proxy: upstream         = %s", c.Upstream)
	log.Printf("proxy: database driver  = %s (auto_migrate=%t)", c.Database.Driver, c.Database.autoMigrate())
	log.Printf("proxy: fail_open        = %t", c.failOpen())
	log.Printf("proxy: audited paths    = %d", len(c.Capture.Paths))
	log.Printf("proxy: prompt scope     = %s", c.Capture.PromptScope)
	log.Printf("proxy: prompt/raw caps  = %d / %d bytes (store_prompt_text=%t store_raw_body=%t)",
		c.Capture.MaxPromptBytes, c.Capture.MaxRawBodyBytes, c.Capture.StorePromptText, c.Capture.StoreRawBody)
	log.Printf("proxy: spool dir        = %s", c.Store.SpoolDir)
	log.Printf("proxy: identity lookup  = %t", c.Identity.Enabled)
	log.Printf("proxy: debug logging    = %t", c.Debug)
}

func (c *Config) applyDefaults() {
	if c.Listen == "" {
		c.Listen = ":3000"
	}
	if c.NodeName == "" {
		if host, err := os.Hostname(); err == nil {
			c.NodeName = host
		}
	}
	if c.FailOpen == nil {
		failOpen := true
		c.FailOpen = &failOpen
	}
	if c.Database.Driver == "" {
		c.Database.Driver = "sqlite"
	}
	if len(c.Capture.Paths) == 0 {
		c.Capture.Paths = defaultCapturePaths
	}
	if c.Capture.MaxBodyBytes <= 0 {
		c.Capture.MaxBodyBytes = 1 << 20 // 1 MiB
	}
	if c.Capture.PromptScope == "" {
		c.Capture.PromptScope = PromptScopeLastUser
	}
	if c.Capture.MaxPromptBytes <= 0 {
		c.Capture.MaxPromptBytes = textColumnSafeBytes
	}
	if c.Capture.MaxRawBodyBytes <= 0 {
		c.Capture.MaxRawBodyBytes = textColumnSafeBytes
	}
	// Clamp loudly: silently storing more than the column accepts would fail the
	// insert, and a failed insert costs the whole batch.
	for _, limit := range []struct {
		name  string
		value *int
	}{
		{"capture.max_prompt_bytes", &c.Capture.MaxPromptBytes},
		{"capture.max_raw_body_bytes", &c.Capture.MaxRawBodyBytes},
	} {
		if *limit.value > textColumnSafeBytes {
			log.Printf("proxy: %s=%d exceeds the %d-byte TEXT column limit, clamping",
				limit.name, *limit.value, textColumnSafeBytes)
			*limit.value = textColumnSafeBytes
		}
		if *limit.value < minTextBytes {
			log.Printf("proxy: %s=%d is too small, raising to %d",
				limit.name, *limit.value, minTextBytes)
			*limit.value = minTextBytes
		}
	}
	if c.Store.BufferSize <= 0 {
		c.Store.BufferSize = 4096
	}
	if c.Store.BatchSize <= 0 {
		c.Store.BatchSize = 100
	}
	if c.Store.FlushIntervalMs <= 0 {
		c.Store.FlushIntervalMs = 1000
	}
	if c.Store.SpoolDir == "" {
		c.Store.SpoolDir = "/var/lib/proxy/spool"
	}
	if c.Store.SpoolReplaySecond <= 0 {
		c.Store.SpoolReplaySecond = 60
	}
	if c.Identity.CacheTTLSeconds <= 0 {
		c.Identity.CacheTTLSeconds = 300
	}
	if c.Identity.CacheSize <= 0 {
		c.Identity.CacheSize = 4096
	}
}

func (c *Config) validate() error {
	if c.Upstream == "" {
		return errors.New("upstream is required (e.g. http://new-api:3000)")
	}
	u, err := url.Parse(c.Upstream)
	if err != nil {
		return fmt.Errorf("invalid upstream %q: %w", c.Upstream, err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("invalid upstream %q: scheme must be http or https", c.Upstream)
	}
	if u.Host == "" {
		return fmt.Errorf("invalid upstream %q: missing host", c.Upstream)
	}
	switch c.Database.Driver {
	case "mysql", "postgres", "sqlite":
	default:
		return fmt.Errorf("unsupported database driver %q (want mysql, postgres or sqlite)", c.Database.Driver)
	}
	if c.Database.DSN == "" {
		return errors.New("database.dsn is required")
	}
	if !c.Capture.StorePromptText && !c.Capture.StoreRawBody {
		return errors.New("capture.store_prompt_text and capture.store_raw_body are both false: nothing would be recorded")
	}
	switch c.Capture.PromptScope {
	case PromptScopeLastUser, PromptScopeUserOnly, PromptScopeAll:
	default:
		return fmt.Errorf("unsupported capture.prompt_scope %q (want %s, %s or %s)",
			c.Capture.PromptScope, PromptScopeLastUser, PromptScopeUserOnly, PromptScopeAll)
	}
	return nil
}

func (c *Config) failOpen() bool {
	return c.FailOpen == nil || *c.FailOpen
}

// matchPath reports whether path matches pattern. A trailing "*" makes the
// pattern a prefix match; everything else is an exact match.
func matchPath(pattern, path string) bool {
	if prefix, ok := strings.CutSuffix(pattern, "*"); ok {
		return strings.HasPrefix(path, prefix)
	}
	return pattern == path
}

func (c *CaptureConfig) shouldCapture(path string) bool {
	for _, pattern := range c.Paths {
		if matchPath(pattern, path) {
			return true
		}
	}
	return false
}
