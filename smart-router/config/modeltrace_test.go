package config

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const ownedTestRoot = "/Users/bytedance/.local/share/modeltrace-evidence-20261013/task5-implementation/tmp"

func configDir(t *testing.T) string {
	t.Helper()
	root, err := os.MkdirTemp(ownedTestRoot, "config-d-")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, os.RemoveAll(root)) })
	return root
}

func configHash(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func configPut(t *testing.T, path string, data []byte) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0700))
	require.NoError(t, os.WriteFile(path, data, 0600))
}

func configJSON(t *testing.T, path string, value any) []byte {
	t.Helper()
	data, err := json.Marshal(value)
	require.NoError(t, err)
	configPut(t, path, data)
	return data
}

func configFixture(t *testing.T) (map[string]string, ModelTracePins) {
	t.Helper()
	root := configDir(t)
	python := filepath.Join(root, "python")
	configPut(t, python, []byte("synthetic executable"))
	require.NoError(t, os.Chmod(python, 0700))
	runtime := filepath.Join(root, "runtime")
	files := map[string]string{}
	for _, name := range []string{"worker.py", "engine.py", "__init__.py", "bank_validation.py"} {
		configPut(t, filepath.Join(runtime, name), []byte(""))
		files[name] = configHash(nil)
	}
	runtimeManifest := filepath.Join(runtime, "RUNTIME-MANIFEST.json")
	runtimeData := configJSON(t, runtimeManifest, map[string]any{"schema_version": 1, "files": files})
	vendor := filepath.Join(root, "vendor")
	vendorFiles := map[string]string{}
	for _, name := range []string{"fingerprint.py", "data/unified_bank.json", "LICENSE"} {
		configPut(t, filepath.Join(vendor, name), []byte("{}"))
		vendorFiles[name] = configHash([]byte("{}"))
	}
	vendorManifest := filepath.Join(vendor, "PROVENANCE.json")
	vendorData := configJSON(t, vendorManifest, map[string]any{
		"schema_version": 1, "files": vendorFiles,
		"source": map[string]string{"url": "https://github.com/xqy2006/ModelTrace.git",
			"commit": "6cd4a8ff0f3f4e49d6d6969dd2fbadfa1569fde2"},
	})
	return map[string]string{
		"SMART_ROUTER_MODELTRACE_ENABLED": "true", "SMART_ROUTER_MODELTRACE_PYTHON": python,
		"SMART_ROUTER_MODELTRACE_DATABASE":         filepath.Join(root, "private.db"),
		"SMART_ROUTER_MODELTRACE_WORKER":           filepath.Join(runtime, "worker.py"),
		"SMART_ROUTER_MODELTRACE_RUNTIME_MANIFEST": runtimeManifest,
		"SMART_ROUTER_MODELTRACE_VENDOR_MANIFEST":  vendorManifest,
		"SMART_ROUTER_MODELTRACE_BANK":             filepath.Join(vendor, "data/unified_bank.json"),
		"SMART_ROUTER_MODELTRACE_INGEST_KEY":       strings.Repeat("synthetic-key-", 3),
	}, ModelTracePins{configHash([]byte("synthetic executable")), configHash(runtimeData), configHash(vendorData)}
}

func TestModelTraceEnablementBeforeEverySecondaryLookup(t *testing.T) {
	for _, value := range []string{"", "false", "trueish"} {
		t.Run(value, func(t *testing.T) {
			names := []string{}
			c, err := LoadModelTrace(func(name string) string {
				names = append(names, name)
				return value
			}, ModelTracePins{})
			assert.Equal(t, []string{"SMART_ROUTER_MODELTRACE_ENABLED"}, names)
			assert.False(t, c.Enabled)
			if value == "trueish" {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestModelTraceValidPinnedBuiltinConfiguration(t *testing.T) {
	values, pins := configFixture(t)
	names := []string{}
	c, err := LoadModelTrace(func(name string) string {
		names = append(names, name)
		return values[name]
	}, pins)
	require.NoError(t, err)
	assert.True(t, c.Enabled)
	assert.Equal(t, "127.0.0.1:18086", c.ListenAddress)
	assert.Equal(t, values["SMART_ROUTER_MODELTRACE_DATABASE"], c.DatabasePath)
	assert.Equal(t, configHash([]byte("{}")), c.Process.BankRevision)
	assert.Empty(t, c.Process.StateRoot)
	assert.Equal(t, filepath.Join(filepath.Dir(c.DatabasePath), "modeltrace-tmp"), c.Process.TempDir)
	info, err := os.Stat(c.Process.TempDir)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0700), info.Mode().Perm())
	assert.Len(t, names, 10)
	assert.NotContains(t, c.Process.PythonPath, "synthetic-key")
}

func TestModelTraceRejectsUntrustedConfiguration(t *testing.T) {
	for _, name := range []string{"empty_pin", "wrong_pin", "relative_python", "unclean_python",
		"symlink_python", "arbitrary_bank", "missing_generation", "short_key", "nonloopback",
		"hostname", "bad_optin", "uri_database", "symlink_database", "public_database", "public_tmp", "worker_mismatch"} {
		t.Run(name, func(t *testing.T) {
			v, pins := configFixture(t)
			root := filepath.Dir(v["SMART_ROUTER_MODELTRACE_DATABASE"])
			switch name {
			case "empty_pin":
				pins.PythonSHA256 = ""
			case "wrong_pin":
				pins.RuntimeManifestSHA256 = strings.Repeat("0", 64)
			case "relative_python":
				v["SMART_ROUTER_MODELTRACE_PYTHON"] = "python"
			case "unclean_python":
				v["SMART_ROUTER_MODELTRACE_PYTHON"] = root + "/./python"
			case "symlink_python":
				link := filepath.Join(root, "python-link")
				require.NoError(t, os.Symlink(v["SMART_ROUTER_MODELTRACE_PYTHON"], link))
				v["SMART_ROUTER_MODELTRACE_PYTHON"] = link
			case "arbitrary_bank":
				configPut(t, filepath.Join(root, "bank.json"), []byte("{}"))
				v["SMART_ROUTER_MODELTRACE_BANK"] = filepath.Join(root, "bank.json")
			case "missing_generation":
				v["SMART_ROUTER_MODELTRACE_BANK"] = root
			case "short_key":
				v["SMART_ROUTER_MODELTRACE_INGEST_KEY"] = "short"
			case "nonloopback":
				v["SMART_ROUTER_MODELTRACE_LISTEN"] = "0.0.0.0:18086"
			case "hostname":
				v["SMART_ROUTER_MODELTRACE_LISTEN"] = "localhost:18086"
			case "bad_optin":
				v["SMART_ROUTER_MODELTRACE_ALLOW_NON_LOOPBACK"] = "maybe"
			case "uri_database":
				v["SMART_ROUTER_MODELTRACE_DATABASE"] = "file:test?mode=memory"
			case "symlink_database":
				configPut(t, filepath.Join(root, "target"), nil)
				require.NoError(t, os.Symlink(filepath.Join(root, "target"), v["SMART_ROUTER_MODELTRACE_DATABASE"]))
			case "public_database":
				configPut(t, v["SMART_ROUTER_MODELTRACE_DATABASE"], nil)
				require.NoError(t, os.Chmod(v["SMART_ROUTER_MODELTRACE_DATABASE"], 0644))
			case "public_tmp":
				require.NoError(t, os.Mkdir(filepath.Join(root, "modeltrace-tmp"), 0755))
			case "worker_mismatch":
				v["SMART_ROUTER_MODELTRACE_WORKER"] = v["SMART_ROUTER_MODELTRACE_PYTHON"]
			}
			c, err := LoadModelTrace(func(key string) string { return v[key] }, pins)
			assert.Error(t, err)
			assert.False(t, c.Enabled)
		})
	}
}

func TestModelTraceExplicitNonLoopbackOptIn(t *testing.T) {
	v, pins := configFixture(t)
	v["SMART_ROUTER_MODELTRACE_LISTEN"] = "0.0.0.0:18086"
	v["SMART_ROUTER_MODELTRACE_ALLOW_NON_LOOPBACK"] = "true"
	c, err := LoadModelTrace(func(key string) string { return v[key] }, pins)
	require.NoError(t, err)
	assert.Equal(t, "0.0.0.0:18086", c.ListenAddress)
}

func configGeneration(t *testing.T, v map[string]string) string {
	t.Helper()
	root := filepath.Join(filepath.Dir(v["SMART_ROUTER_MODELTRACE_DATABASE"]), "state")
	generation := "generation-" + strings.Repeat("a", 32)
	entry := func(name string) map[string]string {
		path := "generations/" + generation + "/" + name
		configPut(t, filepath.Join(root, path), []byte("{}"))
		return map[string]string{"path": path, "sha256": configHash([]byte("{}"))}
	}
	configJSON(t, filepath.Join(root, "current.json"), map[string]any{
		"schema_version": 1, "generation": generation, "bank": entry("bank.json"),
		"state": entry("state.json"), "references": entry("references.jsonl"), "families": map[string]any{},
	})
	v["SMART_ROUTER_MODELTRACE_BANK"] = root
	return root
}

func TestModelTracePublishedGenerationDoesNotChooseFixedBank(t *testing.T) {
	v, pins := configFixture(t)
	root := configGeneration(t, v)
	c, err := LoadModelTrace(func(key string) string { return v[key] }, pins)
	require.NoError(t, err)
	assert.Equal(t, root, c.Process.StateRoot)
	assert.Empty(t, c.Process.BankPath)
	assert.Empty(t, c.Process.BankRevision)
	_, err = os.Stat(filepath.Join(root, ".writer.lock"))
	assert.True(t, os.IsNotExist(err))
}

func TestModelTraceMetadataRejectsPostConstructionTampering(t *testing.T) {
	for _, name := range []string{"worker", "runtime_manifest", "generation_claim", "generation_member"} {
		t.Run(name, func(t *testing.T) {
			v, pins := configFixture(t)
			if strings.HasPrefix(name, "generation") {
				configGeneration(t, v)
			}
			c, err := LoadModelTrace(func(key string) string { return v[key] }, pins)
			require.NoError(t, err)
			switch name {
			case "worker":
				configPut(t, c.Process.WorkerPath, []byte("tampered payload"))
			case "runtime_manifest":
				configPut(t, c.Process.RuntimeManifestPath, []byte(`{"files":{"worker.py":"`+strings.Repeat("f", 64)+`"}}`))
			case "generation_claim":
				path := filepath.Join(c.Process.StateRoot, "current.json")
				data, err := os.ReadFile(path)
				require.NoError(t, err)
				var current map[string]any
				require.NoError(t, json.Unmarshal(data, &current))
				current["bank"].(map[string]any)["sha256"] = strings.Repeat("f", 64)
				configJSON(t, path, current)
			case "generation_member":
				path := filepath.Join(c.Process.StateRoot, "generations", "generation-"+strings.Repeat("a", 32), "state.json")
				configPut(t, path, []byte(`{"tampered":true}`))
			}
			metadata, err := c.Metadata()
			assert.Error(t, err, "metadata must validate the exact pinned/stable snapshot")
			assert.Empty(t, metadata.WorkerPayloadSHA256)
			assert.Empty(t, metadata.StartupBankRevision)
		})
	}
}

func TestModelTraceMetadataSeparatesIdentitiesAndExcludesKey(t *testing.T) {
	for _, generation := range []bool{false, true} {
		v, pins := configFixture(t)
		if generation {
			configGeneration(t, v)
		}
		c, err := LoadModelTrace(func(key string) string { return v[key] }, pins)
		require.NoError(t, err)
		first, err := c.Metadata()
		require.NoError(t, err)
		assert.Equal(t, configHash([]byte("{}")), first.StartupBankRevision)
		assert.Equal(t, pins.RuntimeManifestSHA256, first.RuntimeManifestRevision)
		assert.Equal(t, configHash(nil), first.WorkerPayloadSHA256)
		assert.NotEqual(t, first.RuntimeManifestRevision, first.WorkerPayloadSHA256)
		c.IngestKey = []byte(strings.Repeat("another-synthetic-key", 3))
		second, err := c.Metadata()
		require.NoError(t, err)
		assert.Equal(t, first.PublicConfigSHA256, second.PublicConfigSHA256)
	}
}
