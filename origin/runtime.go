package origin

import (
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const credentialContextKey = "origin_ai_credential"

var originKeyPattern = regexp.MustCompile(`^sk-oa-[A-Za-z0-9]{40}$`)

type Runtime struct {
	Enabled          bool
	Manager          *Manager
	ChannelBindings  map[string]int
	KafkaBrokers     []string
	Outbox           OutboxWorkerConfig
	OutboxPoll       time.Duration
	AttemptLease     time.Duration
	AttemptHeartbeat time.Duration
	WorkerID         string
}

var activeRuntime atomic.Pointer[Runtime]

func Enabled() bool {
	runtime := activeRuntime.Load()
	return runtime != nil && runtime.Enabled
}

func ActiveManager() *Manager {
	runtime := activeRuntime.Load()
	if runtime == nil || !runtime.Enabled {
		return nil
	}
	return runtime.Manager
}

func Configure(runtime *Runtime) {
	activeRuntime.Store(runtime)
}

func ConfigureForTest(enabled bool, manager *Manager) func() {
	previous := activeRuntime.Load()
	activeRuntime.Store(&Runtime{Enabled: enabled, Manager: manager})
	return func() {
		activeRuntime.Store(previous)
	}
}

func InitializeFromEnv() error {
	config, err := LoadConfigFromEnv()
	if err != nil {
		return err
	}
	if !config.Enabled {
		Configure(&Runtime{Enabled: false})
		return nil
	}
	httpClient, err := NewMTLSHTTPClient(config)
	if err != nil {
		return err
	}
	control := NewControlClient(config.PlatformBaseURL, httpClient, config.PlatformTimeout)
	catalog := NewCatalogView(timeNow)
	hostname, _ := os.Hostname()
	hostname = strings.TrimSpace(hostname)
	if len(hostname) > 48 {
		hostname = hostname[:48]
	}
	workerID := fmt.Sprintf("%s-%s", hostname, uuid.NewString())
	config.Outbox.WorkerID = workerID
	Configure(&Runtime{
		Enabled:          true,
		Manager:          NewManager(control, catalog, timeNow),
		ChannelBindings:  config.ChannelBindings,
		KafkaBrokers:     append([]string(nil), config.KafkaBrokers...),
		Outbox:           config.Outbox,
		OutboxPoll:       config.OutboxPollInterval,
		AttemptLease:     config.AttemptLease,
		AttemptHeartbeat: config.AttemptHeartbeat,
		WorkerID:         workerID,
	})
	return nil
}

var timeNow = func() time.Time { return time.Now() }

func ResolveChannelID(approvedChannelID string) (int, error) {
	runtime := activeRuntime.Load()
	if runtime == nil || !runtime.Enabled {
		return 0, errors.New("Origin integration is disabled")
	}
	if channelID := runtime.ChannelBindings[approvedChannelID]; channelID > 0 {
		return channelID, nil
	}
	channelID, err := strconv.Atoi(approvedChannelID)
	if err != nil || channelID <= 0 {
		return 0, errors.New("approved Origin channel has no local binding")
	}
	return channelID, nil
}

func EnsureRequestID(c *gin.Context) string {
	requestID := uuid.NewString()
	c.Set(common.RequestIdKey, requestID)
	if c.Request != nil {
		ctx := context.WithValue(c.Request.Context(), common.RequestIdKey, requestID)
		c.Request = c.Request.WithContext(ctx)
	}
	c.Header(common.RequestIdKey, requestID)
	return requestID
}

func SetCredential(c *gin.Context, credential string) bool {
	if c == nil || !originKeyPattern.MatchString(credential) {
		return false
	}
	c.Set(credentialContextKey, credential)
	common.SetContextKey(c, constant.ContextKeyOriginIntegration, true)
	return true
}

func Credential(c *gin.Context) (string, bool) {
	if c == nil {
		return "", false
	}
	value, exists := c.Get(credentialContextKey)
	if !exists {
		return "", false
	}
	credential, ok := value.(string)
	return credential, ok && credential != ""
}

func ClearCredential(c *gin.Context) {
	if c != nil {
		c.Set(credentialContextKey, "")
	}
}

func IsRequest(c *gin.Context) bool {
	return c != nil && common.GetContextKeyBool(c, constant.ContextKeyOriginIntegration)
}
