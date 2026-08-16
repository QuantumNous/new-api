package common

import (
	"math"
	"sync"
	"time"
)

const networkSeriesLength = 12

// NetworkBandwidth contains application-level request/response throughput.
// Up is request-body traffic read from clients and Down is response-body
// traffic written back to clients. Values are decimal Mbps.
type NetworkBandwidth struct {
	Available  bool
	UpMbps     float64
	DownMbps   float64
	UpSeries   []float64
	DownSeries []float64
}

var applicationTrafficSampler struct {
	sync.Mutex
	initialized  bool
	lastRequest  uint64
	lastResponse uint64
	lastAt       time.Time
	latest       NetworkBandwidth
}

// SampleNetworkBandwidth converts cumulative application traffic into a
// throughput sample. The first sample only establishes a baseline.
func SampleNetworkBandwidth() NetworkBandwidth {
	return sampleNetworkBandwidthAt(time.Now())
}

func sampleNetworkBandwidthAt(now time.Time) NetworkBandwidth {
	requestBytes, responseBytes := ApplicationTrafficSnapshot()
	return sampleNetworkBandwidthCounters(now, requestBytes, responseBytes)
}

func sampleNetworkBandwidthCounters(now time.Time, requestBytes, responseBytes uint64) NetworkBandwidth {
	applicationTrafficSampler.Lock()
	defer applicationTrafficSampler.Unlock()

	if !applicationTrafficSampler.initialized {
		applicationTrafficSampler.initialized = true
		applicationTrafficSampler.lastRequest = requestBytes
		applicationTrafficSampler.lastResponse = responseBytes
		applicationTrafficSampler.lastAt = now
		applicationTrafficSampler.latest = NetworkBandwidth{}
		return NetworkBandwidth{}
	}

	elapsed := now.Sub(applicationTrafficSampler.lastAt).Seconds()
	if elapsed <= 0 || requestBytes < applicationTrafficSampler.lastRequest || responseBytes < applicationTrafficSampler.lastResponse {
		applicationTrafficSampler.lastRequest = requestBytes
		applicationTrafficSampler.lastResponse = responseBytes
		applicationTrafficSampler.lastAt = now
		applicationTrafficSampler.latest = NetworkBandwidth{}
		return NetworkBandwidth{}
	}

	upMbps := bytesPerSecondToMbps(float64(requestBytes-applicationTrafficSampler.lastRequest) / elapsed)
	downMbps := bytesPerSecondToMbps(float64(responseBytes-applicationTrafficSampler.lastResponse) / elapsed)
	applicationTrafficSampler.lastRequest = requestBytes
	applicationTrafficSampler.lastResponse = responseBytes
	applicationTrafficSampler.lastAt = now
	applicationTrafficSampler.latest = NetworkBandwidth{
		Available:  true,
		UpMbps:     upMbps,
		DownMbps:   downMbps,
		UpSeries:   appendSeries(applicationTrafficSampler.latest.UpSeries, upMbps),
		DownSeries: appendSeries(applicationTrafficSampler.latest.DownSeries, downMbps),
	}
	return cloneNetworkBandwidth(applicationTrafficSampler.latest)
}

// ResetNetworkBandwidthSampler drops the previous baseline and history.
func ResetNetworkBandwidthSampler() {
	applicationTrafficSampler.Lock()
	defer applicationTrafficSampler.Unlock()
	applicationTrafficSampler.initialized = false
	applicationTrafficSampler.lastRequest = 0
	applicationTrafficSampler.lastResponse = 0
	applicationTrafficSampler.lastAt = time.Time{}
	applicationTrafficSampler.latest = NetworkBandwidth{}
}

func bytesPerSecondToMbps(bytesPerSecond float64) float64 {
	value := bytesPerSecond * 8 / 1_000_000
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return 0
	}
	return value
}

func appendSeries(series []float64, value float64) []float64 {
	result := append([]float64(nil), series...)
	result = append(result, value)
	if len(result) > networkSeriesLength {
		result = result[len(result)-networkSeriesLength:]
	}
	return result
}

func cloneNetworkBandwidth(value NetworkBandwidth) NetworkBandwidth {
	value.UpSeries = append([]float64(nil), value.UpSeries...)
	value.DownSeries = append([]float64(nil), value.DownSeries...)
	return value
}
