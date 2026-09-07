package common

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"strconv"
	"sync"
)

type NodeIdentity struct {
	Name                    string `json:"name"`
	Source                  string `json:"source"`
	ManuallyConfigured      bool   `json:"manually_configured"`
	ShouldConfigureManually bool   `json:"should_configure_manually"`
}

func initNodeNameIdentity() {
	if envNodeName := os.Getenv("NODE_NAME"); envNodeName != "" {
		NodeName = envNodeName
		NodeNameSource = NodeNameSourceManual
		NodeNameManuallyConfigured = true
		return
	}

	hostname, _ := os.Hostname()
	NodeName = hostname
	NodeNameSource = NodeNameSourceHostname
	NodeNameManuallyConfigured = false
}

func GetNodeIdentity() NodeIdentity {
	return NodeIdentity{
		Name:                    NodeName,
		Source:                  NodeNameSource,
		ManuallyConfigured:      NodeNameManuallyConfigured,
		ShouldConfigureManually: !NodeNameManuallyConfigured,
	}
}

var (
	instanceFingerprintOnce sync.Once
	instanceFingerprintVal  string
)

// InstanceFingerprint returns an 8-hex-char identifier for this process
// instance. It is derived from NodeName, falling back to the OS process ID
// when NodeName is empty (hostname lookup failed and no NODE_NAME env var was
// set). It is computed once on first use — after InitEnv has set NodeName —
// and cached for the process lifetime, so request_ids carrying it remain valid
// as idempotency keys across restarts of the same instance.
//
// The value occupies characters 24-31 of every request_id produced by
// NewRequestId (see common/utils.go), making it a stable grouping key for
// per-instance analysis without a dedicated column.
//
// Residual collision risk: two instances where hostname lookup fails on both
// (NodeName empty) and the PIDs happen to match would share a fingerprint. At
// that point the nanosecond timestamp prefix and 8-char random suffix on
// NewRequestId still protect the UNIQUE index on request_id.
func InstanceFingerprint() string {
	instanceFingerprintOnce.Do(func() {
		name := NodeName
		if name == "" {
			name = strconv.Itoa(os.Getpid())
		}
		h := sha256.Sum256([]byte(name))
		instanceFingerprintVal = hex.EncodeToString(h[:4])
	})
	return instanceFingerprintVal
}
