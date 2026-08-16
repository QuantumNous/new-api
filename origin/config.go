package origin

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type Config struct {
	Enabled            bool
	PlatformBaseURL    string
	PlatformCAFile     string
	ClientCertFile     string
	ClientKeyFile      string
	PlatformTimeout    time.Duration
	ChannelBindings    map[string]int
	KafkaBrokers       []string
	Outbox             OutboxWorkerConfig
	OutboxPollInterval time.Duration
	AttemptLease       time.Duration
	AttemptHeartbeat   time.Duration
}

func LoadConfigFromEnv() (Config, error) {
	enabled := false
	if rawEnabled := strings.TrimSpace(os.Getenv("ORIGIN_INTEGRATION_ENABLED")); rawEnabled != "" {
		parsedEnabled, err := strconv.ParseBool(rawEnabled)
		if err != nil {
			return Config{}, errors.New("ORIGIN_INTEGRATION_ENABLED must be true or false")
		}
		enabled = parsedEnabled
	}
	if !enabled {
		return Config{Enabled: false}, nil
	}
	platformTimeoutMS, err := originEnvInt("ORIGIN_PLATFORM_TIMEOUT_MS", 2000)
	if err != nil {
		return Config{}, err
	}
	outboxBatchSize, err := originEnvInt("ORIGIN_OUTBOX_BATCH_SIZE", 100)
	if err != nil {
		return Config{}, err
	}
	outboxLeaseMS, err := originEnvInt("ORIGIN_OUTBOX_LEASE_MS", 30000)
	if err != nil {
		return Config{}, err
	}
	outboxMaxAttempts, err := originEnvInt("ORIGIN_OUTBOX_MAX_ATTEMPTS", 10)
	if err != nil {
		return Config{}, err
	}
	outboxPollMS, err := originEnvInt("ORIGIN_OUTBOX_POLL_INTERVAL_MS", 1000)
	if err != nil {
		return Config{}, err
	}
	attemptLeaseMS, err := originEnvInt("ORIGIN_ATTEMPT_LEASE_MS", 120000)
	if err != nil {
		return Config{}, err
	}
	attemptHeartbeatMS, err := originEnvInt("ORIGIN_ATTEMPT_HEARTBEAT_MS", 30000)
	if err != nil {
		return Config{}, err
	}
	config := Config{
		Enabled:         true,
		PlatformBaseURL: strings.TrimSpace(os.Getenv("ORIGIN_PLATFORM_BASE_URL")),
		PlatformCAFile:  strings.TrimSpace(os.Getenv("ORIGIN_PLATFORM_CA_FILE")),
		ClientCertFile:  strings.TrimSpace(os.Getenv("ORIGIN_PLATFORM_CLIENT_CERT_FILE")),
		ClientKeyFile:   strings.TrimSpace(os.Getenv("ORIGIN_PLATFORM_CLIENT_KEY_FILE")),
		PlatformTimeout: time.Duration(platformTimeoutMS) * time.Millisecond,
		ChannelBindings: make(map[string]int),
		Outbox: OutboxWorkerConfig{
			BatchSize:   outboxBatchSize,
			Lease:       time.Duration(outboxLeaseMS) * time.Millisecond,
			MaxAttempts: outboxMaxAttempts,
		},
		OutboxPollInterval: time.Duration(outboxPollMS) * time.Millisecond,
		AttemptLease:       time.Duration(attemptLeaseMS) * time.Millisecond,
		AttemptHeartbeat:   time.Duration(attemptHeartbeatMS) * time.Millisecond,
	}
	if config.PlatformBaseURL == "" || config.PlatformCAFile == "" || config.ClientCertFile == "" || config.ClientKeyFile == "" {
		return Config{}, errors.New("Origin integration requires Platform URL, CA, client certificate and client key")
	}
	parsed, err := url.Parse(config.PlatformBaseURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return Config{}, errors.New("Origin Platform URL must be an absolute https URL without userinfo")
	}
	if config.PlatformTimeout <= 0 {
		return Config{}, errors.New("Origin Platform timeout must be positive")
	}
	for _, broker := range strings.Split(os.Getenv("ORIGIN_KAFKA_BROKERS"), ",") {
		broker = strings.TrimSpace(broker)
		if broker == "" {
			continue
		}
		host, portText, splitErr := net.SplitHostPort(broker)
		port, portErr := strconv.Atoi(portText)
		if splitErr != nil || host == "" || portErr != nil || port < 1 || port > 65535 {
			return Config{}, errors.New("Origin Kafka brokers must be comma-separated host:port addresses")
		}
		config.KafkaBrokers = append(config.KafkaBrokers, broker)
	}
	if len(config.KafkaBrokers) == 0 {
		return Config{}, errors.New("Origin integration requires at least one Kafka broker")
	}
	if config.Outbox.BatchSize < 1 || config.Outbox.BatchSize > 1000 || config.Outbox.Lease <= 0 || config.Outbox.MaxAttempts < 1 || config.OutboxPollInterval <= 0 {
		return Config{}, errors.New("Origin outbox worker settings are invalid")
	}
	if config.AttemptLease <= 0 || config.AttemptHeartbeat <= 0 || config.AttemptHeartbeat >= config.AttemptLease {
		return Config{}, errors.New("Origin request attempt lease settings are invalid")
	}
	bindings := strings.TrimSpace(os.Getenv("ORIGIN_CHANNEL_BINDINGS"))
	if bindings != "" {
		if err := common.Unmarshal([]byte(bindings), &config.ChannelBindings); err != nil {
			return Config{}, errors.New("Origin channel bindings must be a JSON object")
		}
		for approvedID, channelID := range config.ChannelBindings {
			if !catalogIdentifierPattern.MatchString(approvedID) || channelID <= 0 {
				return Config{}, errors.New("Origin channel bindings contain an invalid entry")
			}
		}
	}
	return config, nil
}

func originEnvInt(name string, defaultValue int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return defaultValue, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer", name)
	}
	return value, nil
}

func NewMTLSHTTPClient(config Config) (*http.Client, error) {
	certificate, err := tls.LoadX509KeyPair(config.ClientCertFile, config.ClientKeyFile)
	if err != nil {
		return nil, fmt.Errorf("load Origin Platform client certificate: %w", err)
	}
	caPEM, err := os.ReadFile(config.PlatformCAFile)
	if err != nil {
		return nil, fmt.Errorf("read Origin Platform CA: %w", err)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(caPEM) {
		return nil, errors.New("Origin Platform CA contains no trusted certificate")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{
		MinVersion:   tls.VersionTLS12,
		RootCAs:      roots,
		Certificates: []tls.Certificate{certificate},
	}
	return &http.Client{Transport: transport, Timeout: config.PlatformTimeout}, nil
}
