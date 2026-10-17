package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sys/unix"

	"smart-router/api"
	"smart-router/routing"
	"smart-router/store"
)

func inventoryJSON(cost string) string {
	return `{"schema_version":1,"sources":[{"id":"synthetic","connector":"local","enabled":true}],` +
		`"bindings":[{"id":"bnd_` + strings.Repeat("A", 24) + `","source_id":"synthetic",` +
		`"group":"default","model":"example","protocol":"chat","protocol_plugin":"chat-v1",` +
		`"enabled":true,"cost_microunits":0},{"id":"bnd_` + strings.Repeat("B", 24) +
		`","source_id":"synthetic","group":"default","model":"second","protocol":"chat",` +
		`"protocol_plugin":"chat-v1","enabled":false,"cost_microunits":` + cost + `}]}`
}

func invoke(t *testing.T, input, destination string, extra ...string) (int, string, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "inventory.json")
	require.NoError(t, os.WriteFile(path, []byte(input), 0600))
	args := []string{"apply", "--input", path, "--database", destination, "--hysteresis", "1", "--offline-owned"}
	args = append(args, extra...)
	var out, err bytes.Buffer
	code := run(context.Background(), args, &out, &err)
	return code, out.String(), err.String()
}

func TestLateInvalidPreservesDestination(t *testing.T) {
	for _, existing := range []bool{false, true} {
		t.Run(map[bool]string{false: "absent", true: "existing"}[existing], func(t *testing.T) {
			dir := t.TempDir()
			require.NoError(t, os.Chmod(dir, 0700))
			dest := filepath.Join(dir, "router.db")
			if existing {
				require.NoError(t, os.WriteFile(dest, []byte("preexisting frozen bytes"), 0600))
			}
			before, err := os.ReadDir(dir)
			require.NoError(t, err)
			code, _, diagnostic := invoke(t, inventoryJSON("-1"), dest)
			assert.NotZero(t, code, "late-invalid inventory must fail")
			assert.Contains(t, diagnostic, "invalid_inventory")
			after, err := os.ReadDir(dir)
			require.NoError(t, err)
			assert.Equal(t, before, after, "no stage or intent may be created")
			if existing {
				raw, err := os.ReadFile(dest)
				require.NoError(t, err)
				assert.Equal(t, "preexisting frozen bytes", string(raw))
			} else {
				_, err := os.Lstat(dest)
				assert.True(t, os.IsNotExist(err))
			}
		})
	}
}

func changedInventory(t *testing.T, edit func(map[string]any)) string {
	t.Helper()
	var value map[string]any
	require.NoError(t, json.Unmarshal([]byte(inventoryJSON("7")), &value))
	edit(value)
	raw, err := json.Marshal(value)
	require.NoError(t, err)
	return string(raw)
}

func checkInput(t *testing.T, raw string, extra ...string) (int, string, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "input.json")
	require.NoError(t, os.WriteFile(path, []byte(raw), 0600))
	args := append([]string{"--input", path, "--hysteresis", "1"}, extra...)
	var out, diagnostic bytes.Buffer
	code := run(context.Background(), args, &out, &diagnostic)
	return code, out.String(), diagnostic.String()
}

func TestStrictInventoryBeforeAnyMutation(t *testing.T) {
	cases := map[string]string{
		"duplicate-key":            strings.Replace(inventoryJSON("7"), `"schema_version":1`, `"schema_version":1,"schema_version":1`, 1),
		"trailing-json":            inventoryJSON("7") + "{}",
		"string-cost":              inventoryJSON(`"7"`),
		"fraction-cost":            inventoryJSON("7.0"),
		"exponent-cost":            inventoryJSON("7e0"),
		"overflow-cost":            inventoryJSON("9223372036854775808"),
		"negative-zero-cost":       inventoryJSON("-0"),
		"disabled-subset-overflow": inventoryJSON("9223372036854775807"),
		"oversized":                inventoryJSON("7") + strings.Repeat(" ", 1<<20),
	}
	for _, section := range []string{"sources", "bindings"} {
		fields := []string{"id", "connector", "enabled"}
		if section == "bindings" {
			fields = []string{"id", "source_id", "group", "model", "protocol", "protocol_plugin", "enabled", "cost_microunits"}
		}
		for _, field := range fields {
			for _, null := range []bool{false, true} {
				cases[fmt.Sprintf("%s-%s-null-%v", section, field, null)] = changedInventory(t, func(v map[string]any) {
					record := v[section].([]any)[0].(map[string]any)
					if null {
						record[field] = nil
					} else {
						delete(record, field)
					}
				})
			}
		}
	}
	edits := map[string]func(map[string]any){
		"unknown":           func(v map[string]any) { v["surprise"] = true },
		"case-key":          func(v map[string]any) { v["Schema_version"] = v["schema_version"]; delete(v, "schema_version") },
		"version":           func(v map[string]any) { v["schema_version"] = 2 },
		"empty-sources":     func(v map[string]any) { v["sources"] = []any{} },
		"null-bindings":     func(v map[string]any) { v["bindings"] = nil },
		"duplicate-source":  func(v map[string]any) { v["sources"] = append(v["sources"].([]any), v["sources"].([]any)[0]) },
		"duplicate-binding": func(v map[string]any) { v["bindings"] = append(v["bindings"].([]any), v["bindings"].([]any)[0]) },
		"connector-url": func(v map[string]any) {
			v["sources"].([]any)[0].(map[string]any)["connector"] = "https://fixture.invalid"
		},
		"connector-secret": func(v map[string]any) { v["sources"].([]any)[0].(map[string]any)["connector"] = "sk-secret" },
		"source-space":     func(v map[string]any) { v["sources"].([]any)[0].(map[string]any)["id"] = " synthetic" },
		"source-too-long": func(v map[string]any) {
			v["sources"].([]any)[0].(map[string]any)["connector"] = strings.Repeat("x", 129)
		},
	}
	bindingEdits := map[string]any{
		"id": "bnd_short", "source_id": "dangling", "group": "auto",
		"model": " example", "protocol": "task_bridge", "protocol_plugin": "messages-v1",
		"enabled": "false",
	}
	for field, value := range bindingEdits {
		edits["bad-"+field] = func(v map[string]any) { v["bindings"].([]any)[1].(map[string]any)[field] = value }
	}
	edits["control-model"] = func(v map[string]any) { v["bindings"].([]any)[1].(map[string]any)["model"] = "x\nx" }
	edits["duplicate-source-route"] = func(v map[string]any) { v["bindings"].([]any)[1].(map[string]any)["model"] = "example" }
	edits["six-disabled-per-route"] = func(v map[string]any) {
		var bindings []any
		for i := range 6 {
			bindings = append(bindings, map[string]any{"id": "bnd_" + strings.Repeat(string(rune('C'+i)), 24),
				"source_id": "synthetic", "group": "default", "model": "example", "protocol": "chat",
				"protocol_plugin": "chat-v1", "enabled": false, "cost_microunits": 0})
			v["sources"] = append(v["sources"].([]any), map[string]any{"id": fmt.Sprintf("source%d", i), "connector": "local", "enabled": false})
			bindings[i].(map[string]any)["source_id"] = fmt.Sprintf("source%d", i)
		}
		v["bindings"] = bindings
	}
	edits["257-bindings"] = func(v map[string]any) {
		v["bindings"] = make([]any, 257)
		for i := range v["bindings"].([]any) {
			v["bindings"].([]any)[i] = v["sources"].([]any)[0]
		}
	}
	for name, edit := range edits {
		cases[name] = changedInventory(t, edit)
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			require.NoError(t, os.Chmod(dir, 0700))
			code, _, diagnostic := invoke(t, raw, filepath.Join(dir, "router.db"))
			assert.NotZero(t, code)
			assert.Contains(t, diagnostic, "invalid_inventory")
			entries, err := os.ReadDir(dir)
			require.NoError(t, err)
			assert.Empty(t, entries, "validation must precede all staging/intent writes")
			assert.NotContains(t, diagnostic, "fixture.invalid")
		})
	}
}

func TestExplicitHysteresisAndMaximumBoundary(t *testing.T) {
	code, out, diagnostic := checkInput(t, inventoryJSON("9223372036854775806"))
	assert.Zero(t, code, diagnostic)
	assert.Contains(t, out, "validated")
	code, _, diagnostic = checkInput(t, inventoryJSON("9223372036854775807"), "--hysteresis", "0")
	assert.Zero(t, code, diagnostic)
	for _, value := range []string{"-1", "9223372036854775808"} {
		code, _, _ := checkInput(t, inventoryJSON("7"), "--hysteresis", value)
		assert.NotZero(t, code)
	}
	var outBuf, errBuf bytes.Buffer
	code = run(context.Background(), []string{"--input", "unused"}, &outBuf, &errBuf)
	assert.NotZero(t, code)
	assert.Contains(t, errBuf.String(), "invalid_request")
}

func TestOptionalRegistryIsStrictAndMatchesEnabledInventory(t *testing.T) {
	registry := `[{"binding_id":"bnd_` + strings.Repeat("A", 24) +
		`","channel_id":1,"group":"default","model":"example","protocol":"chat","protocol_plugin":"chat-v1"}]`
	for name, raw := range map[string]string{
		"exact":             registry,
		"wrong-tuple":       strings.Replace(registry, `"example"`, `"wrong"`, 1),
		"disabled-only":     strings.Replace(registry, strings.Repeat("A", 24), strings.Repeat("B", 24), 1),
		"missing-channel":   strings.Replace(registry, `"channel_id":1,`, "", 1),
		"null-channel":      strings.Replace(registry, `"channel_id":1`, `"channel_id":null`, 1),
		"zero-channel":      strings.Replace(registry, `"channel_id":1`, `"channel_id":0`, 1),
		"duplicate-key":     strings.Replace(registry, `"channel_id":1`, `"channel_id":1,"channel_id":1`, 1),
		"duplicate-binding": "[" + registry[1:len(registry)-1] + "," + registry[1:len(registry)-1] + "]",
		"unknown":           strings.Replace(registry, `"channel_id":1`, `"channel_id":1,"unknown":true`, 1),
		"empty":             "[]",
	} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "registry.json")
			require.NoError(t, os.WriteFile(path, []byte(raw), 0600))
			code, _, diagnostic := checkInput(t, inventoryJSON("7"), "--host-registry", path)
			if name == "exact" {
				assert.Zero(t, code, diagnostic)
			} else {
				assert.NotZero(t, code)
				assert.Contains(t, diagnostic, "invalid_registry")
			}
		})
	}
}

func sqliteFixture(t *testing.T, path string, populate bool) {
	t.Helper()
	database, err := store.OpenSQLite(context.Background(), (&url.URL{Scheme: "file", Path: path}).String())
	require.NoError(t, err)
	if populate {
		require.NoError(t, database.UpsertSource(context.Background(), store.Source{ID: "synthetic", Connector: "local", Enabled: true}))
		for i, model := range []string{"example", "second"} {
			require.NoError(t, database.UpsertBinding(context.Background(), store.BindingRecord{
				ID: "bnd_" + strings.Repeat(string(rune('A'+i)), 24), SourceID: "synthetic",
				Group: "default", Model: model, Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
				Enabled: i == 0, CostMicrounits: int64(i * 7),
			}))
		}
		now := time.Unix(100, 0).UTC()
		require.NoError(t, database.SetObservation(context.Background(), "bnd_"+strings.Repeat("A", 24),
			store.Observation{Health: routing.HealthDegraded, ConsecutiveFailures: 2,
				CooldownUntil: now.Add(time.Hour), Fingerprint: "frozen-fingerprint", ObservedAt: now}))
		require.NoError(t, database.RecordDecision(context.Background(), store.Decision{
			RequestID: "frozen-request", Group: "default", Model: "example", Protocol: api.ProtocolChat,
			SnapshotRevision: "frozen-revision", BindingIDs: []string{"bnd_" + strings.Repeat("A", 24)}, CreatedAt: now}))
		require.NoError(t, database.SaveSnapshot(context.Background(), api.SignedSnapshot{Revision: "frozen-revision"}))
		inserted, err := database.RecordOutcome(context.Background(), api.AttemptOutcome{
			EventID: "frozen-event", BindingID: "bnd_" + strings.Repeat("A", 24),
		}, now)
		require.NoError(t, err)
		require.True(t, inserted)
	}
	require.NoError(t, database.Close())
	mutateSQLite(t, path, `CREATE TABLE independent_history (payload TEXT); INSERT INTO independent_history VALUES ('preserved unrelated history')`)
}

func mutateSQLite(t *testing.T, path, query string) {
	t.Helper()
	db, err := sql.Open("sqlite", (&url.URL{Scheme: "file", Path: path}).String())
	require.NoError(t, err)
	_, err = db.Exec(query)
	require.NoError(t, err)
	require.NoError(t, db.Close())
}

func directoryHashes(t *testing.T, dir string) map[string][32]byte {
	t.Helper()
	result := make(map[string][32]byte)
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		require.NoError(t, err)
		result[entry.Name()] = sha256.Sum256(raw)
	}
	return result
}

func TestReadOnlyFullInventoryAndFrozenHistory(t *testing.T) {
	for name, tc := range map[string]struct {
		query string
		want  string
	}{
		"exact":            {"", "exact"},
		"disabled-binding": {`UPDATE bindings SET enabled=1 WHERE model_name='second'`, "conflicting=1"},
		"disabled-source":  {`UPDATE sources SET enabled=0`, "conflicting=1"},
		"disabled-group":   {`UPDATE route_groups SET enabled=0`, "conflicting=1"},
		"disabled-model":   {`UPDATE models SET enabled=0 WHERE name='second'`, "conflicting=1"},
		"connector":        {`UPDATE sources SET connector='different'`, "conflicting=1"},
		"price":            {`UPDATE prices SET cost_microunits=8 WHERE cost_microunits=7`, "conflicting=1"},
		"missing-price":    {`DELETE FROM prices WHERE cost_microunits=7`, "missing=1"},
		"extra-source":     {`INSERT INTO sources VALUES ('extra','local',0)`, "extra=1"},
		"extra-group":      {`INSERT INTO route_groups VALUES ('extra',0)`, "extra=1"},
		"extra-model":      {`INSERT INTO models VALUES ('extra',0)`, "extra=1"},
		"extra-binding":    {`INSERT INTO bindings SELECT 'bnd_CCCCCCCCCCCCCCCCCCCCCCCC',source_id,group_name,model_name,protocol,protocol_plugin,0 FROM bindings LIMIT 1`, "extra=1"},
		"extra-price":      {`INSERT INTO prices VALUES ('bnd_CCCCCCCCCCCCCCCCCCCCCCCC',0)`, "extra=1"},
		"missing-table":    {`DROP TABLE prices`, "incompatible_schema_or_unreadable"},
	} {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "literal ?#% inventory.db")
			sqliteFixture(t, path, true)
			if tc.query != "" {
				mutateSQLite(t, path, tc.query)
			}
			before := directoryHashes(t, dir)
			code, out, diagnostic := checkInput(t, inventoryJSON("7"), "--database", path)
			if name == "exact" {
				assert.Zero(t, code, diagnostic)
			} else {
				assert.NotZero(t, code)
			}
			assert.Contains(t, out+diagnostic, tc.want)
			assert.Equal(t, before, directoryHashes(t, dir), "check must not mutate inventory or history")
			code, _, diagnostic = invoke(t, inventoryJSON("7"), path)
			assert.NotZero(t, code)
			assert.Contains(t, diagnostic, "existing_check_only")
			assert.Equal(t, before, directoryHashes(t, dir), "apply must not mutate any existing database")
		})
	}
}

func TestCheckMissingAndSchemaOnlyDoesNotMigrate(t *testing.T) {
	for _, mode := range []string{"absent", "schema-only", "no-schema", "corrupt"} {
		t.Run(mode, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "router.db")
			switch mode {
			case "schema-only":
				sqliteFixture(t, path, false)
			case "no-schema":
				mutateSQLite(t, path, `CREATE TABLE unrelated (v TEXT); INSERT INTO unrelated VALUES ('preserved')`)
			case "corrupt":
				require.NoError(t, os.WriteFile(path, []byte("not a SQLite database"), 0600))
			}
			before := directoryHashes(t, dir)
			code, out, diagnostic := checkInput(t, inventoryJSON("7"), "--database", path)
			assert.NotZero(t, code)
			want := "incompatible_schema_or_unreadable"
			if mode == "absent" {
				want = "missing_database"
			} else if mode == "schema-only" {
				want = "missing=8"
			}
			assert.Contains(t, out+diagnostic, want)
			assert.Equal(t, before, directoryHashes(t, dir))
		})
	}
}

func TestSafePathsRejectSymlinksAndArbitraryDSNs(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "router.db")
	sqliteFixture(t, path, true)
	link := filepath.Join(t.TempDir(), "db-link")
	require.NoError(t, os.Symlink(path, link))
	dirLink := filepath.Join(t.TempDir(), "dir-link")
	require.NoError(t, os.Symlink(dir, dirLink))
	for _, unsafe := range []string{link, filepath.Join(dirLink, "router.db"), "file:" + path + "?mode=rw", ":memory:", path + "/../router.db"} {
		code, _, diagnostic := checkInput(t, inventoryJSON("7"), "--database", unsafe)
		assert.NotZero(t, code)
		assert.Contains(t, diagnostic, "unsafe_database")
	}
	input := filepath.Join(t.TempDir(), "inventory.json")
	require.NoError(t, os.WriteFile(input, []byte(inventoryJSON("7")), 0600))
	inputLink := filepath.Join(t.TempDir(), "input-link")
	require.NoError(t, os.Symlink(input, inputLink))
	var out, diagnostic bytes.Buffer
	assert.NotZero(t, run(context.Background(), []string{"--input", inputLink, "--hysteresis", "1"}, &out, &diagnostic))
}

func applyBoundary(t *testing.T, destination string, boundary func(string) error, output io.Writer) (int, string) {
	t.Helper()
	input := filepath.Join(t.TempDir(), "inventory.json")
	require.NoError(t, os.WriteFile(input, []byte(inventoryJSON("7")), 0600))
	if output == nil {
		output = io.Discard
	}
	var diagnostic bytes.Buffer
	code := runWithBoundary(context.Background(), []string{"apply", "--input", input, "--database", destination,
		"--hysteresis", "1", "--offline-owned"}, output, &diagnostic, boundary)
	return code, diagnostic.String()
}

func TestInitialPublicationAndFullReopen(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.Chmod(dir, 0700))
	path := filepath.Join(dir, "router ?#%.db")
	var output bytes.Buffer
	code, diagnostic := applyBoundary(t, path, nil, &output)
	require.Zero(t, code, diagnostic)
	assert.Contains(t, output.String(), "published")
	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0600), info.Mode().Perm())
	var stat unix.Stat_t
	require.NoError(t, unix.Lstat(path, &stat))
	assert.Equal(t, uint64(1), uint64(stat.Nlink))
	code, out, diagnostic := checkInput(t, inventoryJSON("7"), "--database", path)
	assert.Zero(t, code, diagnostic)
	assert.Contains(t, out, "exact")
	db, err := sql.Open("sqlite", (&url.URL{Scheme: "file", Path: path, RawQuery: "mode=ro"}).String())
	require.NoError(t, err)
	for _, table := range []string{"health_state", "cooldowns", "fingerprints", "decisions", "outcomes", "snapshots"} {
		var count int
		require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM "+table).Scan(&count))
		assert.Zero(t, count, table)
	}
	require.NoError(t, db.Close())
	before := directoryHashes(t, dir)
	code, diagnostic = applyBoundary(t, path, nil, nil)
	assert.NotZero(t, code)
	assert.Contains(t, diagnostic, "existing_check_only")
	assert.Equal(t, before, directoryHashes(t, dir))
}

func TestPrivateDescriptorSQLiteJournal(t *testing.T) {
	file, err := os.OpenFile(filepath.Join(t.TempDir(), "stage"), os.O_RDWR|os.O_CREATE|os.O_EXCL, 0600)
	require.NoError(t, err)
	defer file.Close()
	uri := (&url.URL{Scheme: "file", Path: descriptorPath(file),
		RawQuery: url.Values{"_pragma": {"journal_mode(MEMORY)"}}.Encode()}).String()
	db, err := store.OpenSQLite(context.Background(), uri)
	require.NoError(t, err)
	require.NoError(t, db.UpsertSource(context.Background(), store.Source{ID: "fixture", Connector: "local", Enabled: true}))
	require.NoError(t, db.Close())
	view, err := readView(context.Background(), file, true)
	require.NoError(t, err)
	assert.Equal(t, []any{"local", int64(1)}, view[0]["fixture"])
}

func TestPrivateStageFailureDoesNotPublishAndCannotRetry(t *testing.T) {
	for _, phase := range []string{"after_source", "after_binding", "verify_stage", "close_stage", "sync_stage"} {
		t.Run(phase, func(t *testing.T) {
			dir := t.TempDir()
			require.NoError(t, os.Chmod(dir, 0700))
			path := filepath.Join(dir, "router.db")
			seen := false
			code, diagnostic := applyBoundary(t, path, func(at string) error {
				if at == phase {
					seen = true
					return errors.New("synthetic failure")
				}
				return nil
			}, nil)
			assert.True(t, seen)
			assert.NotZero(t, code)
			_, err := os.Lstat(path)
			assert.True(t, os.IsNotExist(err))
			assert.NotContains(t, diagnostic, "synthetic failure")
			before := directoryHashes(t, dir)
			code, diagnostic = applyBoundary(t, path, nil, nil)
			assert.NotZero(t, code)
			assert.Contains(t, diagnostic, "apply_terminal_no_retry")
			assert.Equal(t, before, directoryHashes(t, dir))
		})
	}
}

func TestDestinationRaceIsAtomicNoClobber(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.Chmod(dir, 0700))
	path := filepath.Join(dir, "router.db")
	calls := 0
	code, diagnostic := applyBoundary(t, path, func(phase string) error {
		if phase == "before_publish" {
			calls++
			require.NoError(t, os.WriteFile(path, []byte("other owner's winning bytes"), 0600))
		}
		return nil
	}, nil)
	assert.Equal(t, 1, calls)
	assert.NotZero(t, code)
	assert.Contains(t, diagnostic, "publication_unknown_no_retry")
	raw, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Equal(t, "other owner's winning bytes", string(raw))
}

type failingOutput struct{}

func (failingOutput) Write(raw []byte) (int, error) {
	return 0, errors.New("synthetic acknowledgement failure")
}

func TestUnknownPublicationAllowsOnlyReadOnlyReconciliation(t *testing.T) {
	for _, phase := range []string{"after_publish", "sync_parent", "close_state", "close_parent", "acknowledgement"} {
		t.Run(phase, func(t *testing.T) {
			dir := t.TempDir()
			require.NoError(t, os.Chmod(dir, 0700))
			path := filepath.Join(dir, "router.db")
			calls := 0
			var output io.Writer
			if phase == "acknowledgement" {
				output = failingOutput{}
			}
			code, diagnostic := applyBoundary(t, path, func(at string) error {
				if at == "before_publish" {
					calls++
				}
				if at == phase {
					return errors.New("ambiguous failure")
				}
				return nil
			}, output)
			assert.NotZero(t, code)
			assert.Contains(t, diagnostic, "publication_unknown_no_retry")
			assert.Equal(t, 1, calls)
			before := directoryHashes(t, dir)
			code, out, diagnostic := checkInput(t, inventoryJSON("7"), "--database", path)
			assert.Zero(t, code, diagnostic)
			assert.Contains(t, out, "exact")
			assert.Equal(t, before, directoryHashes(t, dir))
			code, diagnostic = applyBoundary(t, path, nil, nil)
			assert.NotZero(t, code)
			assert.Contains(t, diagnostic, "existing_check_only")
			assert.Equal(t, before, directoryHashes(t, dir))
		})
	}
}

func TestSQLiteSidecarsFailClosedWithoutStaleReadOrPublication(t *testing.T) {
	for _, existing := range []bool{false, true} {
		for _, suffix := range []string{"-wal", "-shm", "-journal"} {
			t.Run(fmt.Sprintf("existing-%v%s", existing, suffix), func(t *testing.T) {
				dir := t.TempDir()
				require.NoError(t, os.Chmod(dir, 0700))
				path := filepath.Join(dir, "router.db")
				if existing {
					sqliteFixture(t, path, true)
				}
				require.NoError(t, os.WriteFile(path+suffix, []byte("unreconciled sidecar"), 0600))
				before := directoryHashes(t, dir)
				if existing {
					code, out, diagnostic := checkInput(t, inventoryJSON("7"), "--database", path)
					assert.NotZero(t, code)
					assert.NotContains(t, out, "exact")
					assert.Contains(t, diagnostic, "incompatible_schema_or_unreadable")
				} else {
					code, diagnostic := applyBoundary(t, path, nil, nil)
					assert.NotZero(t, code)
					assert.Contains(t, diagnostic, "unsafe_database")
				}
				assert.Equal(t, before, directoryHashes(t, dir))
				_, err := os.Stat(path + ".inventory-apply")
				assert.True(t, os.IsNotExist(err), "reject orphan sidecars before intent")
			})
		}
	}
}

func TestPreparedStageIdentitySwapCannotPublish(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.Chmod(dir, 0700))
	path := filepath.Join(dir, "router.db")
	code, diagnostic := applyBoundary(t, path, func(phase string) error {
		if phase == "before_publish" {
			stage := filepath.Join(dir, "router.db.inventory-apply", "database")
			require.NoError(t, os.Rename(stage, stage+".original"))
			require.NoError(t, os.WriteFile(stage, []byte("different bytes"), 0600))
		}
		return nil
	}, nil)
	assert.NotZero(t, code)
	assert.Contains(t, diagnostic, "publication_unknown_no_retry")
	_, err := os.Lstat(path)
	assert.True(t, os.IsNotExist(err))
}

func TestStateDirectorySwapCannotPublish(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.Chmod(dir, 0700))
	path := filepath.Join(dir, "router.db")
	code, diagnostic := applyBoundary(t, path, func(phase string) error {
		if phase == "before_publish" {
			state := path + ".inventory-apply"
			require.NoError(t, os.Rename(state, state+".original"))
			require.NoError(t, os.Mkdir(state, 0700))
		}
		return nil
	}, nil)
	assert.NotZero(t, code)
	assert.Contains(t, diagnostic, "publication_unknown_no_retry")
	_, err := os.Lstat(path)
	assert.True(t, os.IsNotExist(err))
}

func TestActualSQLFailureLeavesPartialCommitsPrivate(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.Chmod(dir, 0700))
	path := filepath.Join(dir, "router.db")
	installed := false
	code, diagnostic := applyBoundary(t, path, func(phase string) error {
		if phase == "after_source" {
			installed = true
			mutateSQLite(t, filepath.Join(path+".inventory-apply", "database"),
				`CREATE TRIGGER fail_second BEFORE INSERT ON bindings WHEN NEW.model_name='second'
				 BEGIN SELECT RAISE(ABORT,'synthetic population failure'); END`)
		}
		return nil
	}, nil)
	assert.True(t, installed)
	assert.NotZero(t, code)
	assert.Contains(t, diagnostic, "publication_unknown_no_retry")
	_, err := os.Lstat(path)
	assert.True(t, os.IsNotExist(err))
	db, err := sql.Open("sqlite", (&url.URL{Scheme: "file",
		Path: filepath.Join(path+".inventory-apply", "database"), RawQuery: "mode=ro"}).String())
	require.NoError(t, err)
	var count int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM bindings`).Scan(&count))
	assert.Equal(t, 1, count, "first transaction committed, second failed, neither published")
	require.NoError(t, db.Close())
}

func TestUnsafeApplyOwnershipAndDirectorySwap(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.Chmod(dir, 0755))
	path := filepath.Join(dir, "router.db")
	code, diagnostic := applyBoundary(t, path, nil, nil)
	assert.NotZero(t, code)
	assert.Contains(t, diagnostic, "unsafe_database")
	assert.Empty(t, directoryHashes(t, dir))

	dir = t.TempDir()
	require.NoError(t, os.Chmod(dir, 0700))
	path = filepath.Join(dir, "router.db")
	other := t.TempDir()
	require.NoError(t, os.Chmod(other, 0700))
	renamed := dir + "-moved"
	t.Cleanup(func() { _ = os.RemoveAll(renamed) })
	code, diagnostic = applyBoundary(t, path, func(phase string) error {
		if phase == "before_publish" {
			require.NoError(t, os.Rename(dir, renamed))
			require.NoError(t, os.Symlink(other, dir))
		}
		return nil
	}, nil)
	assert.NotZero(t, code)
	assert.Contains(t, diagnostic, "publication_unknown_no_retry")
	_, err := os.Lstat(filepath.Join(other, "router.db"))
	assert.True(t, os.IsNotExist(err), "never follow swapped directory")
	_, err = os.Lstat(filepath.Join(renamed, "router.db"))
	assert.True(t, os.IsNotExist(err), "identity drift must reject publication")
}
