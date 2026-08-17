package origin

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeneratedOriginContractsMatchPinnedV3Bundle(t *testing.T) {
	type lockedFile struct {
		SourcePath string `json:"source_path"`
		SHA256     string `json:"sha256"`
	}
	var lock struct {
		SnapshotVersion int                   `json:"snapshot_version"`
		SourceCommit    string                `json:"source_commit"`
		SourceSHA256    string                `json:"source_sha256"`
		ContractVersion map[string]any        `json:"contract_versions"`
		Files           map[string]lockedFile `json:"files"`
	}
	root := filepath.Clean("../contracts/origin")
	raw, err := os.ReadFile(filepath.Join(root, "contract-lock.json"))
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal(raw, &lock))

	assert.Equal(t, 3, lock.SnapshotVersion)
	assert.Equal(t, ContractsSHA, lock.SourceCommit)
	assert.Equal(t, ContractsSourceSHA256, lock.SourceSHA256)
	assert.Equal(t, DataPlaneControlContractVersion, lock.ContractVersion["data_plane_control"])
	require.Len(t, lock.Files, 21)
	assert.Contains(t, lock.Files, "examples/data-plane.models.valid.json")
	assert.Contains(t, lock.Files, "examples/data-plane.models.invalid.json")

	for relative, file := range lock.Files {
		path := filepath.Clean(filepath.Join(root, relative))
		rel, err := filepath.Rel(root, path)
		require.NoError(t, err)
		require.NotEqual(t, "..", rel)
		require.NotContains(t, rel, ".."+string(filepath.Separator))
		contents, err := os.ReadFile(path)
		require.NoError(t, err, relative)
		digest := sha256.Sum256(contents)
		assert.Equal(t, file.SHA256, fmt.Sprintf("%x", digest), relative)
	}
}
