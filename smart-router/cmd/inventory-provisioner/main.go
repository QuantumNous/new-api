package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/sys/unix"

	"smart-router/api"
	"smart-router/store"
)

var invalid = errors.New("invalid")
var labelPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`)

type inventory struct {
	Sources  []store.Source
	Bindings []store.BindingRecord
}

// Token parsing preserves exact field names and rejects duplicates at every depth.
func jsonValue(dec *json.Decoder, depth int) (any, error) {
	if depth > 8 {
		return nil, invalid
	}
	token, err := dec.Token()
	if err != nil {
		return nil, invalid
	}
	switch token {
	case json.Delim('{'):
		object := make(map[string]any)
		for dec.More() {
			key, err := dec.Token()
			name, ok := key.(string)
			if err != nil || !ok {
				return nil, invalid
			}
			if _, exists := object[name]; exists {
				return nil, invalid
			}
			value, err := jsonValue(dec, depth+1)
			if err != nil {
				return nil, err
			}
			object[name] = value
		}
		end, err := dec.Token()
		if err != nil || end != json.Delim('}') {
			return nil, invalid
		}
		return object, nil
	case json.Delim('['):
		array := make([]any, 0)
		for dec.More() {
			value, err := jsonValue(dec, depth+1)
			if err != nil {
				return nil, err
			}
			array = append(array, value)
		}
		end, err := dec.Token()
		if err != nil || end != json.Delim(']') {
			return nil, invalid
		}
		return array, nil
	default:
		if _, delimiter := token.(json.Delim); delimiter {
			return nil, invalid
		}
		return token, nil
	}
}

func strictJSON(raw []byte) (any, error) {
	if len(raw) > 1<<20 || !utf8.Valid(raw) {
		return nil, invalid
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	value, err := jsonValue(dec, 0)
	if err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, invalid
	}
	return value, nil
}

func requiredObject(value any, fields ...string) (map[string]any, error) {
	object, ok := value.(map[string]any)
	if !ok || len(object) != len(fields) {
		return nil, invalid
	}
	for _, field := range fields {
		if object[field] == nil {
			return nil, invalid
		}
	}
	return object, nil
}

func integer(value any) (int64, error) {
	number, ok := value.(json.Number)
	if !ok || strings.ContainsAny(string(number), ".eE-") {
		return 0, invalid
	}
	n, err := strconv.ParseInt(string(number), 10, 64)
	if err != nil || n < 0 {
		return 0, invalid
	}
	return n, nil
}

func text(value any) string {
	s, _ := value.(string)
	return s
}

func boundedText(s string, maximum int) bool {
	if len(s) < 1 || len(s) > maximum || strings.TrimSpace(s) != s {
		return false
	}
	for _, c := range s {
		if unicode.IsControl(c) || c == utf8.RuneError || unicode.Is(unicode.Cf, c) {
			return false
		}
	}
	return true
}

func safeLabel(s string) bool {
	lower := strings.ToLower(s)
	return labelPattern.MatchString(s) && !strings.HasPrefix(lower, "sk-") &&
		!strings.HasPrefix(lower, "sk_") && !strings.Contains(lower, "bearer") &&
		!strings.Contains(lower, "token") && !strings.Contains(lower, "secret") &&
		!strings.Contains(lower, "password") && !strings.Contains(lower, "api_key") &&
		!strings.Contains(lower, "apikey")
}

func protocolPair(protocol, plugin string) bool {
	return protocol == "chat" && plugin == "chat-v1" ||
		protocol == "responses" && plugin == "responses-v1" ||
		protocol == "messages" && plugin == "messages-v1"
}

func parseInventory(raw []byte, hysteresis int64) (inventory, error) {
	var result inventory
	value, err := strictJSON(raw)
	if err != nil || hysteresis < 0 {
		return result, invalid
	}
	root, err := requiredObject(value, "schema_version", "sources", "bindings")
	if err != nil {
		return result, err
	}
	version, err := integer(root["schema_version"])
	sources, sourcesOK := root["sources"].([]any)
	bindings, bindingsOK := root["bindings"].([]any)
	if err != nil || version != 1 || !sourcesOK || !bindingsOK ||
		len(sources) < 1 || len(sources) > 256 || len(bindings) < 1 || len(bindings) > 256 {
		return result, invalid
	}
	sourceIDs := make(map[string]bool)
	for _, value := range sources {
		record, err := requiredObject(value, "id", "connector", "enabled")
		if err != nil {
			return result, err
		}
		source := store.Source{ID: text(record["id"]), Connector: text(record["connector"])}
		enabled, ok := record["enabled"].(bool)
		if !ok || !safeLabel(source.ID) || !safeLabel(source.Connector) || sourceIDs[source.ID] {
			return result, invalid
		}
		source.Enabled = enabled
		sourceIDs[source.ID] = true
		result.Sources = append(result.Sources, source)
	}
	ids := make(map[string]bool)
	routes := make(map[[3]string]int)
	sourceRoutes := make(map[[4]string]bool)
	for _, value := range bindings {
		record, err := requiredObject(value, "id", "source_id", "group", "model", "protocol", "protocol_plugin", "enabled", "cost_microunits")
		if err != nil {
			return result, err
		}
		binding := store.BindingRecord{
			ID: text(record["id"]), SourceID: text(record["source_id"]),
			Group: text(record["group"]), Model: text(record["model"]),
			Protocol: api.Protocol(text(record["protocol"])), ProtocolPlugin: text(record["protocol_plugin"]),
		}
		enabled, ok := record["enabled"].(bool)
		cost, err := integer(record["cost_microunits"])
		route := [3]string{binding.Group, binding.Model, string(binding.Protocol)}
		sourceRoute := [4]string{binding.SourceID, binding.Group, binding.Model, string(binding.Protocol)}
		if !ok || err != nil || cost > math.MaxInt64-hysteresis ||
			api.ValidateBindingID(binding.ID) != nil || ids[binding.ID] ||
			!sourceIDs[binding.SourceID] || !boundedText(binding.Group, 128) ||
			binding.Group == "auto" || !boundedText(binding.Model, 256) ||
			!protocolPair(string(binding.Protocol), binding.ProtocolPlugin) || sourceRoutes[sourceRoute] {
			return result, invalid
		}
		routes[route]++
		if routes[route] > 5 {
			return result, invalid
		}
		ids[binding.ID], sourceRoutes[sourceRoute] = true, true
		binding.Enabled, binding.CostMicrounits = enabled, cost
		result.Bindings = append(result.Bindings, binding)
	}
	return result, nil
}

func validateRegistry(raw []byte, inventory inventory) error {
	value, err := strictJSON(raw)
	entries, ok := value.([]any)
	if err != nil || !ok || len(entries) < 1 || len(entries) > 256 {
		return invalid
	}
	enabled := make(map[string]store.BindingRecord)
	for _, binding := range inventory.Bindings {
		if binding.Enabled {
			enabled[binding.ID] = binding
		}
	}
	seen := make(map[string]bool)
	routes := make(map[[3]string]int)
	for _, value := range entries {
		record, err := requiredObject(value, "binding_id", "channel_id", "group", "model", "protocol", "protocol_plugin")
		if err != nil {
			return err
		}
		id := text(record["binding_id"])
		channel, err := integer(record["channel_id"])
		binding, exists := enabled[id]
		group, model := text(record["group"]), text(record["model"])
		protocol, plugin := text(record["protocol"]), text(record["protocol_plugin"])
		if err != nil || channel < 1 || !exists || seen[id] || api.ValidateBindingID(id) != nil ||
			!boundedText(group, 128) || group == "auto" || !boundedText(model, 256) ||
			!protocolPair(protocol, plugin) || group != binding.Group || model != binding.Model ||
			protocol != string(binding.Protocol) || plugin != binding.ProtocolPlugin {
			return invalid
		}
		seen[id] = true
		route := [3]string{group, model, protocol}
		routes[route]++
		if routes[route] > 5 {
			return invalid
		}
	}
	if len(seen) != len(enabled) {
		return invalid
	}
	return nil
}

func directory(path string) (*os.File, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || strings.ContainsAny(path, "\\\x00") {
		return nil, invalid
	}
	root, err := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err != nil {
		return nil, invalid
	}
	for _, part := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		if part == "" {
			continue
		}
		next, err := unix.Openat(root, part, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
		_ = unix.Close(root)
		if err != nil {
			return nil, invalid
		}
		root = next
	}
	return os.NewFile(uintptr(root), "inventory-directory"), nil
}

func readInput(path string) ([]byte, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || !boundedText(path, 4096) {
		return nil, invalid
	}
	dir, err := directory(filepath.Dir(path))
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	fd, err := unix.Openat(int(dir.Fd()), filepath.Base(path), unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err != nil {
		return nil, invalid
	}
	file := os.NewFile(uintptr(fd), "inventory-input")
	before, err := file.Stat()
	if err != nil || !before.Mode().IsRegular() || before.Size() > 1<<20 {
		_ = file.Close()
		return nil, invalid
	}
	raw, readErr := io.ReadAll(io.LimitReader(file, (1<<20)+1))
	after, statErr := file.Stat()
	closeErr := file.Close()
	if readErr != nil || statErr != nil || closeErr != nil || int64(len(raw)) != before.Size() ||
		before.Size() != after.Size() || !before.ModTime().Equal(after.ModTime()) {
		return nil, invalid
	}
	return raw, nil
}

func databaseFile(dir *os.File, name string) (*os.File, error) {
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err != nil {
		return nil, err
	}
	file := os.NewFile(uintptr(fd), "inventory-database")
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		_ = file.Close()
		return nil, invalid
	}
	return file, nil
}

func sidecarsAbsent(dir *os.File, name string) bool {
	for _, suffix := range []string{"-wal", "-shm", "-journal"} {
		var info unix.Stat_t
		if unix.Fstatat(int(dir.Fd()), name+suffix, &info, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return false
		}
	}
	return true
}

func descriptorPath(file *os.File) string {
	prefix := "/dev/fd/"
	if runtime.GOOS == "linux" {
		prefix = "/proc/self/fd/"
	}
	return prefix + strconv.FormatUint(uint64(file.Fd()), 10)
}

type inventoryView [5]map[string][]any

func desiredView(inventory inventory) inventoryView {
	var view inventoryView
	for i := range view {
		view[i] = make(map[string][]any)
	}
	for _, source := range inventory.Sources {
		enabled := int64(0)
		if source.Enabled {
			enabled = 1
		}
		view[0][source.ID] = []any{source.Connector, enabled}
	}
	for _, binding := range inventory.Bindings {
		enabled := int64(0)
		if binding.Enabled {
			enabled = 1
		}
		view[1][binding.ID] = []any{binding.SourceID, binding.Group, binding.Model,
			string(binding.Protocol), binding.ProtocolPlugin, enabled}
		view[2][binding.ID] = []any{binding.CostMicrounits}
		view[3][binding.Group] = []any{int64(1)}
		view[4][binding.Model] = []any{int64(1)}
	}
	return view
}

func readView(ctx context.Context, file *os.File, integrity bool) (inventoryView, error) {
	var view inventoryView
	uri := (&url.URL{Scheme: "file", Path: descriptorPath(file), RawQuery: "mode=ro"}).String()
	db, err := sql.Open("sqlite", uri)
	if err != nil {
		return view, invalid
	}
	db.SetMaxOpenConns(1)
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		_ = db.Close()
		return view, invalid
	}
	readErr := func() error {
		queries := [...]string{
			`SELECT id,connector,enabled FROM sources`,
			`SELECT id,source_id,group_name,model_name,protocol,protocol_plugin,enabled FROM bindings`,
			`SELECT binding_id,cost_microunits FROM prices`,
			`SELECT name,enabled FROM route_groups`,
			`SELECT name,enabled FROM models`,
		}
		for i, query := range queries {
			rows, err := tx.QueryContext(ctx, query)
			if err != nil {
				return invalid
			}
			columns, err := rows.Columns()
			if err != nil {
				_ = rows.Close()
				return invalid
			}
			view[i] = make(map[string][]any)
			for rows.Next() {
				values := make([]any, len(columns))
				targets := make([]any, len(columns))
				for j := range targets {
					targets[j] = &values[j]
				}
				if rows.Scan(targets...) != nil {
					_ = rows.Close()
					return invalid
				}
				key, ok := values[0].(string)
				if _, exists := view[i][key]; !ok || exists {
					_ = rows.Close()
					return invalid
				}
				for _, value := range values[1:] {
					switch value.(type) {
					case string, int64:
					default:
						_ = rows.Close()
						return invalid
					}
				}
				view[i][key] = values[1:]
			}
			err = rows.Err()
			closeErr := rows.Close()
			if err != nil || closeErr != nil {
				return invalid
			}
		}
		if integrity {
			rows, err := tx.QueryContext(ctx, `PRAGMA foreign_key_check`)
			if err != nil {
				return invalid
			}
			hasViolations := rows.Next()
			readErr := rows.Err()
			closeErr := rows.Close()
			if hasViolations || readErr != nil || closeErr != nil {
				return invalid
			}
			var status string
			if tx.QueryRowContext(ctx, `PRAGMA integrity_check`).Scan(&status) != nil || status != "ok" {
				return invalid
			}
		}
		return nil
	}()
	rollbackErr := tx.Rollback()
	closeErr := db.Close()
	if readErr != nil || rollbackErr != nil || closeErr != nil {
		return view, invalid
	}
	return view, nil
}

func compareView(actual, wanted inventoryView) (missing, conflicting, extra int) {
	for i := range wanted {
		for id, expected := range wanted[i] {
			value, exists := actual[i][id]
			if !exists {
				missing++
			} else if !slices.Equal(value, expected) {
				conflicting++
			}
		}
		for id := range actual[i] {
			if _, exists := wanted[i][id]; !exists {
				extra++
			}
		}
	}
	return
}

func directoryIdentity(path string, held *os.File) bool {
	current, err := directory(path)
	if err != nil {
		return false
	}
	before, err := held.Stat()
	after, statErr := current.Stat()
	closeErr := current.Close()
	return err == nil && statErr == nil && closeErr == nil && os.SameFile(before, after)
}

func childIdentity(parent *os.File, name string, held *os.File) bool {
	var named, opened unix.Stat_t
	return unix.Fstatat(int(parent.Fd()), name, &named, unix.AT_SYMLINK_NOFOLLOW) == nil &&
		unix.Fstat(int(held.Fd()), &opened) == nil && named.Dev == opened.Dev &&
		named.Ino == opened.Ino && named.Mode&unix.S_IFMT == opened.Mode&unix.S_IFMT
}

func durableRecord(dir *os.File, name string, value any) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return invalid
	}
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return invalid
	}
	file := os.NewFile(uintptr(fd), "inventory-apply-record")
	n, writeErr := file.Write(append(raw, '\n'))
	syncErr := file.Sync()
	closeErr := file.Close()
	if writeErr != nil || n != len(raw)+1 || syncErr != nil || closeErr != nil || dir.Sync() != nil {
		return invalid
	}
	return nil
}

func ownedLocalDirectory(dir *os.File) bool {
	var info unix.Stat_t
	var fs unix.Statfs_t
	if unix.Fstat(int(dir.Fd()), &info) != nil || info.Uid != uint32(os.Geteuid()) ||
		info.Mode&0777 != 0700 || unix.Fstatfs(int(dir.Fd()), &fs) != nil {
		return false
	}
	switch runtime.GOOS {
	case "darwin":
		return fs.Type == 0x1a || fs.Type == 0x11 // APFS or HFS.
	case "linux":
		return fs.Type == 0xef53 || fs.Type == 0x58465342 ||
			fs.Type == 0x9123683e || fs.Type == 0x794c7630
	default:
		return false
	}
}

// Only test callers supply a boundary callback; there are no CLI fault switches.
func publishInitial(ctx context.Context, dir *os.File, destination string, inventory inventory,
	inputHash [32]byte, stdout io.Writer, boundary func(string) error) string {
	if !ownedLocalDirectory(dir) || !directoryIdentity(filepath.Dir(destination), dir) {
		return "unsafe_database"
	}
	if !sidecarsAbsent(dir, filepath.Base(destination)) {
		return "unsafe_database"
	}
	at := func(phase string) error {
		if boundary != nil {
			return boundary(phase)
		}
		return nil
	}
	parentFD := int(dir.Fd())
	stateName := filepath.Base(destination) + ".inventory-apply"
	if unix.Mkdirat(parentFD, stateName, 0700) != nil {
		return "apply_terminal_no_retry"
	}
	stateFD, err := unix.Openat(parentFD, stateName, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err != nil {
		return "publication_unknown_no_retry"
	}
	state := os.NewFile(uintptr(stateFD), "inventory-apply-state")
	unknown := func() string {
		_ = durableRecord(state, "unknown.json", map[string]string{"state": "unknown", "retry": "forbidden"})
		_ = state.Close()
		return "publication_unknown_no_retry"
	}
	if durableRecord(state, "intent.json", map[string]any{
		"schema_version": 1, "input_sha256": fmt.Sprintf("%x", inputHash),
		"state": "one_shot_started", "retry": "forbidden",
	}) != nil || dir.Sync() != nil {
		return unknown()
	}
	fd, err := unix.Openat(stateFD, "database", unix.O_RDWR|unix.O_CREAT|unix.O_EXCL|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0600)
	if err != nil {
		return unknown()
	}
	stage := os.NewFile(uintptr(fd), "inventory-staging-database")
	uri := (&url.URL{Scheme: "file", Path: descriptorPath(stage),
		RawQuery: url.Values{"_pragma": {"journal_mode(MEMORY)"}}.Encode()}).String()
	database, err := store.OpenSQLite(ctx, uri)
	if err != nil {
		_ = stage.Close()
		return unknown()
	}
	populateErr := func() error {
		for _, source := range inventory.Sources {
			if err := database.UpsertSource(ctx, source); err != nil {
				return err
			}
			if err := at("after_source"); err != nil {
				return err
			}
		}
		for _, binding := range inventory.Bindings {
			if err := database.UpsertBinding(ctx, binding); err != nil {
				return err
			}
			if err := at("after_binding"); err != nil {
				return err
			}
		}
		return nil
	}()
	closeErr := database.Close()
	if populateErr != nil || closeErr != nil || at("close_stage") != nil {
		_ = stage.Close()
		return unknown()
	}
	actual, err := readView(ctx, stage, true)
	missing, conflicting, extra := compareView(actual, desiredView(inventory))
	if err != nil || missing+conflicting+extra != 0 || at("verify_stage") != nil {
		_ = stage.Close()
		return unknown()
	}
	if !sidecarsAbsent(state, "database") {
		_ = stage.Close()
		return unknown()
	}
	before, err := stage.Stat()
	var named unix.Stat_t
	var opened unix.Stat_t
	if err != nil || unix.Fstat(int(stage.Fd()), &opened) != nil ||
		unix.Fstatat(stateFD, "database", &named, unix.AT_SYMLINK_NOFOLLOW) != nil ||
		named.Dev != opened.Dev || named.Ino != opened.Ino || named.Mode&unix.S_IFMT != unix.S_IFREG ||
		named.Uid != uint32(os.Geteuid()) || named.Nlink != 1 || before.Size() < 1 ||
		stage.Chmod(0600) != nil || stage.Sync() != nil || at("sync_stage") != nil {
		_ = stage.Close()
		return unknown()
	}
	hash := sha256.New()
	_, readErr := io.Copy(hash, stage)
	closeErr = stage.Close()
	if readErr != nil || closeErr != nil || state.Sync() != nil ||
		durableRecord(state, "prepared.json", map[string]string{
			"database_sha256": fmt.Sprintf("%x", hash.Sum(nil)), "state": "prepared",
		}) != nil {
		return unknown()
	}
	if at("before_publish") != nil || ctx.Err() != nil ||
		!directoryIdentity(filepath.Dir(destination), dir) || !childIdentity(dir, stateName, state) ||
		!sidecarsAbsent(dir, filepath.Base(destination)) {
		return unknown()
	}
	var checked unix.Stat_t
	if unix.Fstatat(stateFD, "database", &checked, unix.AT_SYMLINK_NOFOLLOW) != nil ||
		checked.Dev != named.Dev || checked.Ino != named.Ino || checked.Size != named.Size ||
		checked.Nlink != 1 || checked.Mode&0777 != 0600 {
		return unknown()
	}
	// This is the sole publication attempt. Never overwrite, unlink or retry the destination.
	if unix.Linkat(stateFD, "database", parentFD, filepath.Base(destination), 0) != nil ||
		at("after_publish") != nil {
		return unknown()
	}
	var final unix.Stat_t
	if unix.Fstatat(parentFD, filepath.Base(destination), &final, unix.AT_SYMLINK_NOFOLLOW) != nil ||
		final.Dev != named.Dev || final.Ino != named.Ino ||
		unix.Unlinkat(stateFD, "database", 0) != nil || state.Sync() != nil ||
		dir.Sync() != nil || at("sync_parent") != nil ||
		!directoryIdentity(filepath.Dir(destination), dir) || !childIdentity(dir, stateName, state) {
		return unknown()
	}
	if durableRecord(state, "outcome.json", map[string]string{"state": "publication_durable", "retry": "forbidden"}) != nil {
		return unknown()
	}
	if dir.Close() != nil || at("close_parent") != nil || at("close_state") != nil {
		return unknown()
	}
	if state.Close() != nil {
		return "publication_unknown_no_retry"
	}
	if at("acknowledgement") != nil {
		return "publication_unknown_no_retry"
	}
	message := "inventory-provisioner: published\n"
	n, err := io.WriteString(stdout, message)
	if err != nil || n != len(message) {
		return "publication_unknown_no_retry"
	}
	return ""
}

func runWithBoundary(ctx context.Context, args []string, stdout, stderr io.Writer, boundary func(string) error) int {
	flags := flag.NewFlagSet("inventory-provisioner", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	var input, destination, registry string
	var hysteresis int64
	var offline bool
	flags.StringVar(&input, "input", "", "")
	flags.StringVar(&destination, "database", "", "")
	flags.Int64Var(&hysteresis, "hysteresis", 0, "")
	flags.BoolVar(&offline, "offline-owned", false, "")
	flags.StringVar(&registry, "host-registry", "", "")
	mode := "check"
	if len(args) > 0 && (args[0] == "apply" || args[0] == "check") {
		mode = args[0]
		args = args[1:]
	}
	fail := func(code string) int {
		_, _ = io.WriteString(stderr, "inventory-provisioner: "+code+"\n")
		return 1
	}
	if flags.Parse(args) != nil || flags.NArg() != 0 {
		return fail("invalid_request")
	}
	explicitHysteresis := false
	flags.Visit(func(f *flag.Flag) {
		if f.Name == "hysteresis" {
			explicitHysteresis = true
		}
	})
	if input == "" || !explicitHysteresis || hysteresis < 0 || mode == "apply" && (!offline || destination == "") {
		return fail("invalid_request")
	}
	raw, err := readInput(input)
	if err != nil {
		return fail("invalid_inventory")
	}
	inventory, err := parseInventory(raw, hysteresis)
	if err != nil {
		return fail("invalid_inventory")
	}
	if registry != "" {
		raw, err := readInput(registry)
		if err != nil || validateRegistry(raw, inventory) != nil {
			return fail("invalid_registry")
		}
	}
	if destination != "" {
		if !filepath.IsAbs(destination) || filepath.Clean(destination) != destination ||
			!boundedText(destination, 4096) || strings.Contains(destination, "\\") {
			return fail("unsafe_database")
		}
		dir, err := directory(filepath.Dir(destination))
		if err != nil {
			return fail("unsafe_database")
		}
		defer dir.Close()
		file, err := databaseFile(dir, filepath.Base(destination))
		if mode == "apply" {
			if file != nil {
				_ = file.Close()
			}
			if err == nil {
				return fail("existing_check_only")
			}
			if err != unix.ENOENT {
				return fail("unsafe_database")
			}
			if code := publishInitial(ctx, dir, destination, inventory, sha256.Sum256(raw), stdout, boundary); code != "" {
				return fail(code)
			}
			return 0
		} else {
			if err == unix.ENOENT {
				return fail("missing_database")
			}
			if err != nil {
				return fail("unsafe_database")
			}
			if !sidecarsAbsent(dir, filepath.Base(destination)) {
				_ = file.Close()
				return fail("incompatible_schema_or_unreadable")
			}
			actual, readErr := readView(ctx, file, false)
			identityOK := childIdentity(dir, filepath.Base(destination), file) &&
				directoryIdentity(filepath.Dir(destination), dir)
			closeErr := file.Close()
			if readErr != nil || closeErr != nil || !identityOK || !sidecarsAbsent(dir, filepath.Base(destination)) ||
				dir.Close() != nil {
				return fail("incompatible_schema_or_unreadable")
			}
			missing, conflicting, extra := compareView(actual, desiredView(inventory))
			if missing+conflicting+extra != 0 {
				_, _ = fmt.Fprintf(stdout, "inventory-provisioner: missing=%d conflicting=%d extra=%d\n", missing, conflicting, extra)
				return 1
			}
			_, _ = io.WriteString(stdout, "inventory-provisioner: exact\n")
			return 0
		}
	}
	_, _ = io.WriteString(stdout, "inventory-provisioner: validated\n")
	return 0
}

func run(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return runWithBoundary(ctx, args, stdout, stderr, nil)
}

func main() {
	os.Exit(run(context.Background(), os.Args[1:], os.Stdout, os.Stderr))
}
