package autopricing

import (
	_ "embed"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

//go:embed frozen_snapshot.json
var frozenSnapshotJSON []byte

//go:embed frozen_snapshot.sha256
var frozenSnapshotSHA256 string

type frozenSnapshotDocument struct {
	SchemaVersion int                    `json:"schema_version"`
	Version       string                 `json:"version"`
	GeneratedAt   time.Time              `json:"generated_at"`
	SourceVersion string                 `json:"source_version"`
	Records       map[string]PriceRecord `json:"records"`
}

// LoadFrozenSnapshot verifies and restores the repository snapshot used only
// when no durable active catalog exists during cold start.
func LoadFrozenSnapshot() (*CatalogSnapshot, error) {
	return loadFrozenSnapshotAt(time.Now().UTC())
}

func loadFrozenSnapshotAt(now time.Time) (*CatalogSnapshot, error) {
	expected := strings.TrimSpace(strings.ToLower(frozenSnapshotSHA256))
	if len(expected) != 64 {
		return nil, fmt.Errorf("frozen pricing snapshot checksum is malformed")
	}
	if _, err := hex.DecodeString(expected); err != nil {
		return nil, fmt.Errorf("decode frozen pricing snapshot checksum: %w", err)
	}
	actual := hex.EncodeToString(common.Sha256Raw(frozenSnapshotJSON))
	if actual != expected {
		return nil, fmt.Errorf("frozen pricing snapshot checksum mismatch: expected %s, got %s", expected, actual)
	}

	var document frozenSnapshotDocument
	if err := common.Unmarshal(frozenSnapshotJSON, &document); err != nil {
		return nil, fmt.Errorf("parse frozen pricing snapshot: %w", err)
	}
	if document.SchemaVersion != 1 || document.Version == "" || document.SourceVersion == "" || document.GeneratedAt.IsZero() {
		return nil, fmt.Errorf("frozen pricing snapshot metadata is incomplete")
	}
	source := newSourceCatalog(SourceOverride, document.SourceVersion)
	for key, record := range document.Records {
		key = normalizeKey(key)
		if key == "" || normalizeKey(record.Model) != key {
			return nil, fmt.Errorf("frozen pricing snapshot record %q has an invalid model key", key)
		}
		if record.ValidUntil.IsZero() {
			return nil, fmt.Errorf("frozen pricing snapshot record %q has no validity deadline", key)
		}
		if !record.ValidUntil.After(now) {
			continue
		}
		record.PrimarySource = SourceOverride
		record.SourceVersion = document.SourceVersion
		setRecordFieldSources(&record, SourceOverride)
		source.Records[key] = record
	}
	catalog, err := MergeSources(source)
	if err != nil {
		return nil, fmt.Errorf("restore frozen pricing snapshot: %w", err)
	}
	snapshot := catalog.Snapshot()
	snapshot.Version = document.Version
	snapshot.UpdatedAt = document.GeneratedAt
	snapshot.SourceVersions = map[SourceID]string{SourceOverride: document.SourceVersion}
	return snapshot, nil
}
