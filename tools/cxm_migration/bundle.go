package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/QuantumNous/new-api/common"
)

func writeBundle(path string, bundle MigrationBundle) (MigrationBundle, error) {
	if path == "" {
		return MigrationBundle{}, errors.New("bundle path is required")
	}
	if _, err := os.Stat(path); err == nil {
		return MigrationBundle{}, fmt.Errorf("refusing to overwrite existing bundle %s", path)
	} else if !os.IsNotExist(err) {
		return MigrationBundle{}, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return MigrationBundle{}, err
	}
	bundle.Manifest.Version = bundle.Version
	bundle.Manifest.AgentID = bundle.AgentID
	bundle.Manifest.Counts = bundleCounts(bundle)
	bundle.Manifest.SHA256 = ""
	data, err := common.Marshal(bundle)
	if err != nil {
		return MigrationBundle{}, fmt.Errorf("marshal bundle: %w", err)
	}
	digest := sha256.Sum256(data)
	bundle.Manifest.SHA256 = hex.EncodeToString(digest[:])
	data, err = common.Marshal(bundle)
	if err != nil {
		return MigrationBundle{}, fmt.Errorf("marshal bundle manifest: %w", err)
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return MigrationBundle{}, err
	}
	defer f.Close()
	if _, err := f.Write(data); err != nil {
		return MigrationBundle{}, err
	}
	if err := f.Sync(); err != nil {
		return MigrationBundle{}, err
	}
	return bundle, nil
}

func readBundle(path string) (MigrationBundle, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return MigrationBundle{}, err
	}
	var bundle MigrationBundle
	if err := common.Unmarshal(data, &bundle); err != nil {
		return MigrationBundle{}, fmt.Errorf("unmarshal bundle: %w", err)
	}
	if bundle.Version != migrationBundleVersion || bundle.Manifest.Version != migrationBundleVersion {
		return MigrationBundle{}, fmt.Errorf("unsupported bundle version %d", bundle.Version)
	}
	expected := bundle.Manifest.SHA256
	bundle.Manifest.SHA256 = ""
	canonical, err := common.Marshal(bundle)
	if err != nil {
		return MigrationBundle{}, err
	}
	digest := sha256.Sum256(canonical)
	if expected != hex.EncodeToString(digest[:]) {
		return MigrationBundle{}, errors.New("bundle SHA-256 mismatch")
	}
	bundle.Manifest.SHA256 = expected
	return bundle, nil
}

func bundleCounts(bundle MigrationBundle) map[string]int64 {
	return map[string]int64{
		"customers":     int64(len(bundle.Customers)),
		"credits":       int64(len(bundle.Credits)),
		"credit_logs":   int64(len(bundle.CreditLogs)),
		"packages":      int64(len(bundle.Packages)),
		"offers":        int64(len(bundle.Offers)),
		"redemptions":   int64(len(bundle.Redemptions)),
		"user_packages": int64(len(bundle.UserPackages)),
		"quota_grants":  int64(len(bundle.QuotaGrants)),
		"logs":          int64(len(bundle.Logs)),
		"tokens":        int64(len(bundle.Tokens)),
	}
}
