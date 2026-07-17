package common

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"syscall"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
)

// TestIsClientDisconnectError guards the distinction that makes the
// distributor's 400s diagnosable: a client that vanished mid-upload must not be
// reported as "invalid request", and a genuinely malformed body must not be
// excused as a disconnect.
func TestIsClientDisconnectError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		// Disconnects: the client stopped sending before we had the whole body.
		{"truncated body", io.ErrUnexpectedEOF, true},
		{"wrapped truncated body", errors.Wrap(io.ErrUnexpectedEOF, "reading body"), true},
		{"request context canceled", context.Canceled, true},
		{"connection already closed", net.ErrClosed, true},
		{"body read after close", http.ErrBodyReadAfterClose, true},
		{"connection reset by peer", &net.OpError{Op: "read", Err: syscall.ECONNRESET}, true},

		// Not disconnects: the request itself is the problem.
		{"nil", nil, false},
		// A dial/write OpError cannot come from reading the inbound body; if one
		// ever shows up here it is an upstream error leaking in, and calling it a
		// client disconnect would silently swallow it.
		{"upstream dial failure", &net.OpError{Op: "dial", Err: syscall.ECONNREFUSED}, false},
		{"write failure", &net.OpError{Op: "write", Err: syscall.EPIPE}, false},
		{"clean eof on empty body", io.EOF, false},
		{"malformed json", &json.SyntaxError{}, false},
		{"body too large", ErrRequestBodyTooLarge, false},
		{"unrelated failure", errors.New("boom"), false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, IsClientDisconnectError(tc.err))
		})
	}
}
