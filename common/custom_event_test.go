package common

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWriteDataDoesNotPanicOnNonStringData(t *testing.T) {
	tests := []struct {
		name       string
		data       interface{}
		wantSuffix string
	}{
		{name: "string starting with data", data: "data: hello", wantSuffix: "\n\n"},
		{name: "string not starting with data", data: "event: hello", wantSuffix: ""},
		{name: "map data", data: map[string]string{"a": "b"}, wantSuffix: ""},
		{name: "struct data", data: struct{ A int }{A: 1}, wantSuffix: ""},
		{name: "int data", data: 42, wantSuffix: ""},
		{name: "bytes data", data: []byte("data bytes"), wantSuffix: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			w := checkWriter(&buf)

			require.NotPanics(t, func() {
				_ = writeData(w, tt.data)
			})

			if tt.wantSuffix != "" {
				assert.True(t, strings.HasSuffix(buf.String(), tt.wantSuffix), "output = %q", buf.String())
			}
		})
	}
}