package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func assertMilliseconds(t *testing.T, expected int64, actual *int64) {
	t.Helper()
	require.NotNil(t, actual)
	assert.Equal(t, expected, *actual)
}

func TestRequestTimingSnapshotForStreamingRequest(t *testing.T) {
	start := time.Unix(100, 0)
	session := NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start.Add(10*time.Millisecond), true)
	session.MarkClientWrite(start.Add(15*time.Millisecond), start.Add(16*time.Millisecond))
	session.MarkFirstUpstreamData(start.Add(30 * time.Millisecond))
	session.MarkClientWrite(start.Add(35*time.Millisecond), start.Add(36*time.Millisecond))
	session.MarkClientWrite(start.Add(60*time.Millisecond), start.Add(61*time.Millisecond))

	timing := session.Snapshot(start.Add(70*time.Millisecond), false)

	require.NotNil(t, timing)
	assert.Equal(t, int64(70), timing.TotalMs)
	assertMilliseconds(t, 10, timing.GatewayMs)
	assertMilliseconds(t, 20, timing.UpstreamFirstDataMs)
	assertMilliseconds(t, 5, timing.FirstDataToClientMs)
	assertMilliseconds(t, 26, timing.ClientStreamMs)
	assertMilliseconds(t, 9, timing.FinalizeMs)
	assert.Nil(t, timing.UpstreamResponseMs)
	assert.Nil(t, timing.ResponseWriteMs)
}

func TestRequestTimingSnapshotForNonStreamingRequest(t *testing.T) {
	start := time.Unix(200, 0)
	session := NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start.Add(10*time.Millisecond), false)
	session.MarkClientWrite(start.Add(40*time.Millisecond), start.Add(45*time.Millisecond))
	session.MarkClientWrite(start.Add(46*time.Millisecond), start.Add(47*time.Millisecond))

	timing := session.Snapshot(start.Add(50*time.Millisecond), false)

	require.NotNil(t, timing)
	assert.Equal(t, int64(50), timing.TotalMs)
	assertMilliseconds(t, 10, timing.GatewayMs)
	assertMilliseconds(t, 30, timing.UpstreamResponseMs)
	assertMilliseconds(t, 7, timing.ResponseWriteMs)
	assertMilliseconds(t, 3, timing.FinalizeMs)
	assert.Nil(t, timing.UpstreamFirstDataMs)
	assert.Nil(t, timing.FirstDataToClientMs)
	assert.Nil(t, timing.ClientStreamMs)
}

func TestRequestTimingSnapshotForUpstreamErrorBeforeClientWrite(t *testing.T) {
	start := time.Unix(250, 0)
	session := NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start.Add(10*time.Millisecond), false)

	timing := session.Snapshot(start.Add(45*time.Millisecond), true)

	require.NotNil(t, timing)
	assertMilliseconds(t, 10, timing.GatewayMs)
	assertMilliseconds(t, 35, timing.UpstreamErrorMs)
	assert.Nil(t, timing.UpstreamResponseMs)
	assert.Nil(t, timing.FinalizeMs)
}

func TestRequestTimingSnapshotForUpstreamFailure(t *testing.T) {
	start := time.Unix(300, 0)
	session := NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start.Add(10*time.Millisecond), false)

	timing := session.Snapshot(start.Add(45*time.Millisecond), true)

	require.NotNil(t, timing)
	assert.Equal(t, int64(45), timing.TotalMs)
	assertMilliseconds(t, 10, timing.GatewayMs)
	assertMilliseconds(t, 35, timing.UpstreamErrorMs)
	assert.Nil(t, timing.UpstreamResponseMs)
	assert.Nil(t, timing.FinalizeMs)
}

func TestRequestTimingSnapshotForGatewayFailure(t *testing.T) {
	start := time.Unix(400, 0)
	session := NewRequestTimingSession(start)

	timing := session.Snapshot(start.Add(20*time.Millisecond), true)

	require.NotNil(t, timing)
	assert.Equal(t, int64(20), timing.TotalMs)
	assertMilliseconds(t, 20, timing.GatewayMs)
	assert.Nil(t, timing.UpstreamErrorMs)
}

func TestRequestTimingSnapshotIncludesRetriesInUpstreamPhase(t *testing.T) {
	start := time.Unix(500, 0)
	session := NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start.Add(10*time.Millisecond), true)
	session.MarkFirstUpstreamData(start.Add(20 * time.Millisecond))
	session.MarkUpstreamAttempt(start.Add(30*time.Millisecond), true)
	session.MarkFirstUpstreamData(start.Add(50 * time.Millisecond))
	session.MarkClientWrite(start.Add(55*time.Millisecond), start.Add(56*time.Millisecond))

	timing := session.Snapshot(start.Add(60*time.Millisecond), false)

	require.NotNil(t, timing)
	assertMilliseconds(t, 10, timing.GatewayMs)
	assertMilliseconds(t, 40, timing.UpstreamFirstDataMs)
}

func TestRequestTimingFirstDataPromotesResponseToStreaming(t *testing.T) {
	start := time.Unix(550, 0)
	session := NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start.Add(10*time.Millisecond), false)
	session.MarkFirstUpstreamData(start.Add(30 * time.Millisecond))
	session.MarkClientWrite(start.Add(35*time.Millisecond), start.Add(36*time.Millisecond))

	timing := session.Snapshot(start.Add(40*time.Millisecond), false)

	require.NotNil(t, timing)
	assertMilliseconds(t, 20, timing.UpstreamFirstDataMs)
	assert.Nil(t, timing.UpstreamResponseMs)
}

func TestRequestTimingStreamPromotionIgnoresWritesBeforeFirstData(t *testing.T) {
	start := time.Unix(575, 0)
	session := NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start.Add(10*time.Millisecond), false)
	session.SetStream(true)
	session.MarkClientWrite(start.Add(15*time.Millisecond), start.Add(16*time.Millisecond))
	session.MarkFirstUpstreamData(start.Add(30 * time.Millisecond))
	session.MarkClientWrite(start.Add(35*time.Millisecond), start.Add(36*time.Millisecond))

	timing := session.Snapshot(start.Add(40*time.Millisecond), false)

	require.NotNil(t, timing)
	assertMilliseconds(t, 5, timing.FirstDataToClientMs)
	assert.Nil(t, timing.UpstreamResponseMs)
}

func TestRequestTimingSnapshotPreservesZeroMillisecondPhases(t *testing.T) {
	start := time.Unix(600, 0)
	session := NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start, false)
	session.MarkClientWrite(start, start)

	timing := session.Snapshot(start, false)

	require.NotNil(t, timing)
	assert.Equal(t, int64(0), timing.TotalMs)
	assertMilliseconds(t, 0, timing.GatewayMs)
	assertMilliseconds(t, 0, timing.UpstreamResponseMs)
	assertMilliseconds(t, 0, timing.ResponseWriteMs)
	assertMilliseconds(t, 0, timing.FinalizeMs)
}
