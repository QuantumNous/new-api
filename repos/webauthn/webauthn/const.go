package webauthn

import (
	"time"
)

const (
	errFmtFieldNotValidURI = "field '%s' is not a valid URI: %w"
	errFmtConfigValidate   = "error occurred validating the configuration: %w"
)

const (
	defaultTimeoutUVD = time.Millisecond * 120000
	defaultTimeout    = time.Millisecond * 300000
)
