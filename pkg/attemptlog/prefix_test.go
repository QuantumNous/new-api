package attemptlog

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// firstBlockSize is the size of the first block in the sparse schedule.
const firstBlockSize = 256

// TestSparseChainHashPrefixSharing pins the core property: two byte sequences
// sharing a common prefix share the initial block hashes, so the training
// pipeline can walk chains to find the longest common prefix. The schedule is
// fixed, so absolute positions are consistent regardless of total length.
func TestSparseChainHashPrefixSharing(t *testing.T) {
	short := strings.Repeat("a", firstBlockSize)
	medium := strings.Repeat("a", firstBlockSize*3)
	long := strings.Repeat("a", firstBlockSize+sparseBlockSizes[1]+sparseBlockSizes[2])

	hShort := sparseChainHash([]byte(short))
	hMedium := sparseChainHash([]byte(medium))
	hLong := sparseChainHash([]byte(long))

	assert.Equal(t, 16, len(hShort))
	assert.True(t, len(hMedium) >= 16)
	assert.True(t, len(hLong) >= 16)

	assert.Equal(t, hShort, hMedium[:16], "first block hash must match")
	assert.Equal(t, hShort, hLong[:16], "first block hash must match")
}

// TestSparseChainHashAbsolutePositionConsistency verifies that a 200KB body
// and a 1.2MB body sharing the first 200KB produce the same block hashes for
// all blocks that fit ENTIRELY within the shared prefix. The boundary block
// (partial in the short body, full in the long body) naturally differs.
func TestSparseChainHashAbsolutePositionConsistency(t *testing.T) {
	sharedPrefix := strings.Repeat("x", 200*1024)
	body1 := []byte(sharedPrefix)
	body2 := []byte(sharedPrefix + strings.Repeat("y", 1024*1024))

	h1 := sparseChainHash(body1)
	h2 := sparseChainHash(body2)

	// Count how many blocks fit entirely within the 200KB shared prefix.
	fullCoverage := 0
	for _, bs := range sparseBlockSizes {
		if fullCoverage+bs > 200*1024 {
			break
		}
		fullCoverage += bs
	}
	fullBlocks := fullCoverage / 256 // approximate; just need the count
	// Recount properly by walking the schedule.
	fullBlocks = 0
	covered := 0
	for _, bs := range sparseBlockSizes {
		if covered+bs > 200*1024 {
			break
		}
		covered += bs
		fullBlocks++
	}
	assert.True(t, fullBlocks >= 8, "200KB should have at least 8 full blocks")
	sharedHex := fullBlocks * 16
	assert.Equal(t, h1[:sharedHex], h2[:sharedHex],
		"blocks fitting entirely within the shared prefix must match")
}

func TestSparseChainHashByteExact(t *testing.T) {
	a := sparseChainHash([]byte(`{"system":"hello"}`))
	b := sparseChainHash([]byte(`{"system":"hello "}`))
	assert.NotEqual(t, a, b, "trailing space must change the hash")

	c := sparseChainHash([]byte(`{"system":"hello"}`))
	assert.Equal(t, a, c, "identical input must hash the same")
}

func TestSparseChainHashEmpty(t *testing.T) {
	assert.Equal(t, "", sparseChainHash(nil))
	assert.Equal(t, "", sparseChainHash([]byte{}))
}

func TestSparseChainHashPartialBlock(t *testing.T) {
	data := strings.Repeat("x", 300)
	h := sparseChainHash([]byte(data))
	assert.Equal(t, 16*2, len(h), "300 bytes should produce 2 hashes")

	data2 := strings.Repeat("x", 256) + strings.Repeat("y", 44)
	h2 := sparseChainHash([]byte(data2))
	assert.Equal(t, h[:16], h2[:16], "first block must match")
	assert.NotEqual(t, h[16:], h2[16:], "partial block must differ")
}

func TestSparseChainHashBlockCount(t *testing.T) {
	cases := []struct {
		size      int
		maxBlocks int
	}{
		{256, 1},
		{1024, 3},         // 256+256+512
		{8192, 6},         // +1024+2048+4096
		{1200 * 1024, 14}, // 13 full + 1 partial
	}
	for _, tc := range cases {
		data := strings.Repeat("a", tc.size)
		h := sparseChainHash([]byte(data))
		blocks := len(h) / 16
		assert.True(t, blocks <= tc.maxBlocks, "size %d: %d blocks > max %d", tc.size, blocks, tc.maxBlocks)
	}
}

func TestHashHexEmpty(t *testing.T) {
	assert.Equal(t, "", hashHex(nil))
	assert.Equal(t, "", hashHex([]byte{}))
}

func TestHashHexStable(t *testing.T) {
	h1 := hashHex([]byte("hello"))
	h2 := hashHex([]byte("hello"))
	assert.Equal(t, h1, h2)
	assert.Equal(t, 16, len(h1))
	assert.NotEqual(t, h1, hashHex([]byte("hello!")))
}
