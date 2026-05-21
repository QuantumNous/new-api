package model

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLogQuotaDataDeltaRefundSubtractsQuotaWithoutCount(t *testing.T) {
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	const hour = int64(1_700_000_000)
	bucket := hour - (hour % 3600)

	LogQuotaData(1, "user", "model-a", 1000, hour, 50)
	LogQuotaDataDelta(1, "user", "model-a", -300, hour, 10, 0)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()

	key := fmt.Sprintf("%d-%s-%s-%d", 1, "user", "model-a", bucket)
	data := CacheQuotaData[key]
	assert.NotNil(t, data)
	assert.Equal(t, 1, data.Count)
	assert.Equal(t, 700, data.Quota)
	assert.Equal(t, 60, data.TokenUsed)
}
