package origin

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfigDefaultsToDisabled(t *testing.T) {
	t.Setenv("ORIGIN_INTEGRATION_ENABLED", "")

	config, err := LoadConfigFromEnv()

	require.NoError(t, err)
	assert.False(t, config.Enabled)
}

func TestLoadConfigRejectsInvalidOriginModeAndWorkerNumbers(t *testing.T) {
	t.Setenv("ORIGIN_INTEGRATION_ENABLED", "tru")
	_, err := LoadConfigFromEnv()
	require.Error(t, err)

	t.Setenv("ORIGIN_INTEGRATION_ENABLED", "true")
	t.Setenv("ORIGIN_PLATFORM_BASE_URL", "https://platform.internal")
	t.Setenv("ORIGIN_PLATFORM_CA_FILE", "/run/secrets/origin-ca.pem")
	t.Setenv("ORIGIN_PLATFORM_CLIENT_CERT_FILE", "/run/secrets/origin-client.pem")
	t.Setenv("ORIGIN_PLATFORM_CLIENT_KEY_FILE", "/run/secrets/origin-client-key.pem")
	t.Setenv("ORIGIN_KAFKA_BROKERS", "redpanda:9092")
	t.Setenv("ORIGIN_OUTBOX_BATCH_SIZE", "not-a-number")

	_, err = LoadConfigFromEnv()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ORIGIN_OUTBOX_BATCH_SIZE")
}

func TestLoadConfigRequiresPlatformAndMTLSWhenEnabled(t *testing.T) {
	t.Setenv("ORIGIN_INTEGRATION_ENABLED", "true")
	t.Setenv("ORIGIN_PLATFORM_BASE_URL", "")
	t.Setenv("ORIGIN_PLATFORM_CA_FILE", "")
	t.Setenv("ORIGIN_PLATFORM_CLIENT_CERT_FILE", "")
	t.Setenv("ORIGIN_PLATFORM_CLIENT_KEY_FILE", "")

	_, err := LoadConfigFromEnv()

	require.Error(t, err)
	assert.NotContains(t, err.Error(), "Authorization")
}

func TestLoadConfigRejectsInsecurePlatformURL(t *testing.T) {
	t.Setenv("ORIGIN_INTEGRATION_ENABLED", "true")
	t.Setenv("ORIGIN_PLATFORM_BASE_URL", "http://platform.internal")
	t.Setenv("ORIGIN_PLATFORM_CA_FILE", "/run/secrets/origin-ca.pem")
	t.Setenv("ORIGIN_PLATFORM_CLIENT_CERT_FILE", "/run/secrets/origin-client.pem")
	t.Setenv("ORIGIN_PLATFORM_CLIENT_KEY_FILE", "/run/secrets/origin-client-key.pem")

	_, err := LoadConfigFromEnv()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "https")
}

func TestLoadConfigRequiresKafkaAndValidWorkerSettingsWhenEnabled(t *testing.T) {
	t.Setenv("ORIGIN_INTEGRATION_ENABLED", "true")
	t.Setenv("ORIGIN_PLATFORM_BASE_URL", "https://platform.internal")
	t.Setenv("ORIGIN_PLATFORM_CA_FILE", "/run/secrets/origin-ca.pem")
	t.Setenv("ORIGIN_PLATFORM_CLIENT_CERT_FILE", "/run/secrets/origin-client.pem")
	t.Setenv("ORIGIN_PLATFORM_CLIENT_KEY_FILE", "/run/secrets/origin-client-key.pem")
	t.Setenv("ORIGIN_KAFKA_BROKERS", "")

	_, err := LoadConfigFromEnv()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Kafka")

	t.Setenv("ORIGIN_KAFKA_BROKERS", "redpanda-a:9092, redpanda-b:9092")
	t.Setenv("ORIGIN_OUTBOX_BATCH_SIZE", "250")
	t.Setenv("ORIGIN_OUTBOX_POLL_INTERVAL_MS", "500")
	t.Setenv("ORIGIN_OUTBOX_LEASE_MS", "30000")
	t.Setenv("ORIGIN_OUTBOX_MAX_ATTEMPTS", "12")
	t.Setenv("ORIGIN_ATTEMPT_LEASE_MS", "120000")
	t.Setenv("ORIGIN_ATTEMPT_HEARTBEAT_MS", "30000")

	config, err := LoadConfigFromEnv()
	require.NoError(t, err)
	assert.Equal(t, []string{"redpanda-a:9092", "redpanda-b:9092"}, config.KafkaBrokers)
	assert.Equal(t, 250, config.Outbox.BatchSize)
	assert.Equal(t, 500*time.Millisecond, config.OutboxPollInterval)
	assert.Equal(t, 2*time.Minute, config.AttemptLease)
	assert.Equal(t, 30*time.Second, config.AttemptHeartbeat)
}
