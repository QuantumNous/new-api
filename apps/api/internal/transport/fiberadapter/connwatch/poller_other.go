//go:build !linux && !darwin && !freebsd && !netbsd && !openbsd && !dragonfly

package connwatch

import "errors"

// Stub for platforms without epoll/kqueue (mainly Windows). newPoller
// always errors so Listener returns inner unchanged and Done reports nil,
// leaving the adapter on its write-failure detection.
func newPoller() (poller, error) {
	return nil, errors.New("connwatch: unsupported platform")
}

var errPollerClosed = errors.New("connwatch: poller closed")
