package modeltraceapi

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"smart-router/api"
	"smart-router/modeltrace"
)

func TestRecordStrictProjectionRejectsUntrustedFields(t *testing.T) {
	record := modeltrace.Record{ProbeID: "probe-wire", BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
		ClaimedModel: "candidate", Protocol: api.ProtocolChat, EvidenceSHA256: strings.Repeat("a", 64),
		State: modeltrace.StateRunning, ObservedAt: time.Unix(1700000000, 0)}
	data, err := EncodeRecord(record)
	require.NoError(t, err)
	decoded, err := DecodeRecord(data)
	require.NoError(t, err)
	assert.Equal(t, record.ProbeID, decoded.ProbeID)
	assert.Equal(t, record.State, decoded.State)
	var fields map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(data, &fields))
	cases := map[string][]byte{
		"unknown":   append([]byte(`{"secret":"must-not-emit",`), data[1:]...),
		"duplicate": append([]byte(`{"probe_id":"other",`), data[1:]...),
		"nonexact":  bytes.Replace(data, []byte(`"probe_id"`), []byte(`"Probe_ID"`), 1),
		"trailing":  append(append([]byte(nil), data...), []byte(` {}`)...),
		"oversize":  bytes.Repeat([]byte(" "), MaxBodyBytes+1),
		"utf8":      bytes.Replace(data, []byte("candidate"), []byte{0xff}, 1),
		"null":      bytes.Replace(data, []byte(`"running"`), []byte("null"), 1),
	}
	for name, value := range cases {
		t.Run(name, func(t *testing.T) { _, err := DecodeRecord(value); assert.ErrorIs(t, err, ErrInvalidRecord) })
	}
	delete(fields, "error_code")
	missing, err := json.Marshal(fields)
	require.NoError(t, err)
	_, err = DecodeRecord(missing)
	assert.ErrorIs(t, err, ErrInvalidRecord)
	record.ErrorCode = "internal stderr /secret/path"
	_, err = EncodeRecord(record)
	assert.ErrorIs(t, err, ErrInvalidRecord)
}
