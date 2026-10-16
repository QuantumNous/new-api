package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
	"smart-router/modeltrace"
)

var ErrModelTraceConfig = errors.New("modeltrace: configuration_invalid")
var modelTraceDigest = regexp.MustCompile(`^[0-9a-f]{64}$`)

type ModelTracePins struct {
	PythonSHA256          string
	RuntimeManifestSHA256 string
	VendorManifestSHA256  string
}

type ModelTraceConfig struct {
	Enabled       bool
	ListenAddress string
	DatabasePath  string
	IngestKey     []byte
	Process       modeltrace.ProcessConfig
}

type ModelTraceMetadata struct {
	StartupBankRevision     string
	RuntimeManifestRevision string
	WorkerPayloadSHA256     string
	PublicConfigSHA256      string
}

func (c ModelTraceConfig) Metadata() (ModelTraceMetadata, error) {
	if !c.Enabled {
		return ModelTraceMetadata{}, ErrModelTraceConfig
	}
	type snapshot struct {
		runtime, worker, current []byte
		bankRevision, workerHash string
	}
	read := func() (snapshot, error) {
		s := snapshot{bankRevision: c.Process.BankRevision}
		var err error
		s.runtime, err = ReadModelTraceFile(c.Process.RuntimeManifestPath, 256<<10)
		var manifest struct {
			Files map[string]string `json:"files"`
		}
		if err != nil || sha256Hex(s.runtime) != c.Process.RuntimeManifestSHA256 ||
			json.Unmarshal(s.runtime, &manifest) != nil {
			return s, ErrModelTraceConfig
		}
		s.workerHash = manifest.Files["worker.py"]
		s.worker, err = ReadModelTraceFile(c.Process.WorkerPath, 1<<20)
		if err != nil || !modelTraceDigest.MatchString(s.workerHash) || sha256Hex(s.worker) != s.workerHash {
			return s, ErrModelTraceConfig
		}
		if c.Process.StateRoot != "" {
			s.current, err = ReadModelTraceFile(filepath.Join(c.Process.StateRoot, "current.json"), 256<<10)
			var current struct {
				Bank struct {
					SHA256 string `json:"sha256"`
				} `json:"bank"`
			}
			if err != nil || json.Unmarshal(s.current, &current) != nil {
				return s, ErrModelTraceConfig
			}
			s.bankRevision = current.Bank.SHA256
		}
		if !modelTraceDigest.MatchString(s.bankRevision) {
			return s, ErrModelTraceConfig
		}
		return s, nil
	}
	before, err := read()
	if err != nil {
		return ModelTraceMetadata{}, ErrModelTraceConfig
	}
	// Full pinned/current validation must observe the same descriptor and payload.
	if _, err := modeltrace.NewProcessEngine(c.Process); err != nil {
		return ModelTraceMetadata{}, ErrModelTraceConfig
	}
	after, err := read()
	if err != nil || !bytes.Equal(before.runtime, after.runtime) || !bytes.Equal(before.worker, after.worker) ||
		!bytes.Equal(before.current, after.current) {
		return ModelTraceMetadata{}, ErrModelTraceConfig
	}
	m := ModelTraceMetadata{StartupBankRevision: before.bankRevision,
		RuntimeManifestRevision: c.Process.RuntimeManifestSHA256, WorkerPayloadSHA256: before.workerHash}
	public, err := json.Marshal(struct {
		Enabled       bool
		ListenAddress string
		DatabasePath  string
		Process       modeltrace.ProcessConfig
		Metadata      ModelTraceMetadata
	}{c.Enabled, c.ListenAddress, c.DatabasePath, c.Process, m})
	if err != nil {
		return ModelTraceMetadata{}, ErrModelTraceConfig
	}
	m.PublicConfigSHA256 = sha256Hex(public)
	return m, nil
}

func LoadModelTrace(lookup func(string) string, pins ModelTracePins) (ModelTraceConfig, error) {
	if lookup == nil {
		return ModelTraceConfig{}, ErrModelTraceConfig
	}
	switch lookup("SMART_ROUTER_MODELTRACE_ENABLED") {
	case "", "false":
		return ModelTraceConfig{}, nil
	case "true":
	default:
		return ModelTraceConfig{}, ErrModelTraceConfig
	}
	c := ModelTraceConfig{Enabled: true, ListenAddress: "127.0.0.1:18086"}
	if value := lookup("SMART_ROUTER_MODELTRACE_LISTEN"); value != "" {
		c.ListenAddress = value
	}
	c.DatabasePath = lookup("SMART_ROUTER_MODELTRACE_DATABASE")
	python := lookup("SMART_ROUTER_MODELTRACE_PYTHON")
	worker := lookup("SMART_ROUTER_MODELTRACE_WORKER")
	runtime := lookup("SMART_ROUTER_MODELTRACE_RUNTIME_MANIFEST")
	vendor := lookup("SMART_ROUTER_MODELTRACE_VENDOR_MANIFEST")
	bank := lookup("SMART_ROUTER_MODELTRACE_BANK")
	c.IngestKey = []byte(lookup("SMART_ROUTER_MODELTRACE_INGEST_KEY"))
	allow := lookup("SMART_ROUTER_MODELTRACE_ALLOW_NON_LOOPBACK")
	if allow != "" && allow != "false" && allow != "true" {
		return ModelTraceConfig{}, ErrModelTraceConfig
	}
	host, port, err := net.SplitHostPort(c.ListenAddress)
	ip := net.ParseIP(host)
	number, portErr := strconv.Atoi(port)
	if err != nil || ip == nil || portErr != nil || number < 1 || number > 65535 ||
		(allow != "true" && !ip.IsLoopback()) || len(c.IngestKey) < 32 || len(c.IngestKey) > 4096 ||
		!validPins(pins) || ValidateModelTraceDatabase(c.DatabasePath) != nil {
		return ModelTraceConfig{}, ErrModelTraceConfig
	}
	c.Process, err = ModelTraceProcess(python, worker, runtime, vendor, bank, filepath.Dir(c.DatabasePath), pins)
	if err != nil {
		return ModelTraceConfig{}, ErrModelTraceConfig
	}
	temp := filepath.Join(filepath.Dir(c.DatabasePath), "modeltrace-tmp")
	if ModelTracePrivateDirectory(temp) != nil {
		return ModelTraceConfig{}, ErrModelTraceConfig
	}
	c.Process.TempDir = temp
	return c, nil
}

func validPins(p ModelTracePins) bool {
	return modelTraceDigest.MatchString(p.PythonSHA256) && modelTraceDigest.MatchString(p.RuntimeManifestSHA256) &&
		modelTraceDigest.MatchString(p.VendorManifestSHA256)
}

// ModelTraceProcess validates pinned assets without executing a worker or publishing a bank.
func ModelTraceProcess(python, worker, runtime, vendor, bank, temp string, pins ModelTracePins) (modeltrace.ProcessConfig, error) {
	bad := func() (modeltrace.ProcessConfig, error) { return modeltrace.ProcessConfig{}, ErrModelTraceConfig }
	if !validPins(pins) {
		return bad()
	}
	c := modeltrace.ProcessConfig{PythonPath: python, PythonSHA256: pins.PythonSHA256, WorkerPath: worker,
		RuntimeManifestPath: runtime, RuntimeManifestSHA256: pins.RuntimeManifestSHA256,
		VendorManifestPath: vendor, VendorManifestSHA256: pins.VendorManifestSHA256, TempDir: temp}
	if worker != filepath.Join(filepath.Dir(runtime), "worker.py") {
		return bad()
	}
	root, err := modelTraceDirectory(filepath.Dir(bank))
	if err != nil {
		return bad()
	}
	var info unix.Stat_t
	err = unix.Fstatat(root, filepath.Base(bank), &info, unix.AT_SYMLINK_NOFOLLOW)
	unix.Close(root)
	if err != nil || !filepath.IsAbs(bank) || filepath.Clean(bank) != bank {
		return bad()
	}
	switch info.Mode & unix.S_IFMT {
	case unix.S_IFREG:
		if bank != filepath.Join(filepath.Dir(vendor), "data", "unified_bank.json") {
			return bad()
		}
		data, err := ReadModelTraceFile(vendor, 256<<10)
		var manifest struct {
			Files map[string]string `json:"files"`
		}
		if err != nil || sha256Hex(data) != pins.VendorManifestSHA256 || json.Unmarshal(data, &manifest) != nil ||
			!modelTraceDigest.MatchString(manifest.Files["data/unified_bank.json"]) {
			return bad()
		}
		c.BankPath, c.BankRevision = bank, manifest.Files["data/unified_bank.json"]
	case unix.S_IFDIR:
		c.StateRoot = bank
	default:
		return bad()
	}
	pythonRoot, err := modelTraceDirectory(filepath.Dir(python))
	if err != nil {
		return bad()
	}
	err = unix.Fstatat(pythonRoot, filepath.Base(python), &info, unix.AT_SYMLINK_NOFOLLOW)
	unix.Close(pythonRoot)
	if err != nil || info.Mode&unix.S_IFMT != unix.S_IFREG || info.Mode&0111 == 0 {
		return bad()
	}
	if _, err := modeltrace.NewProcessEngine(c); err != nil {
		return bad()
	}
	return c, nil
}

func modelTraceDirectory(path string) (int, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return -1, ErrModelTraceConfig
	}
	root, err := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err != nil {
		return -1, ErrModelTraceConfig
	}
	for _, part := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		if part == "" {
			continue
		}
		next, err := unix.Openat(root, part, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
		unix.Close(root)
		if err != nil {
			return -1, ErrModelTraceConfig
		}
		root = next
	}
	return root, nil
}

func ReadModelTraceFile(path string, maximum int64) ([]byte, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || maximum < 1 || maximum > 128<<20 {
		return nil, ErrModelTraceConfig
	}
	root, err := modelTraceDirectory(filepath.Dir(path))
	if err != nil {
		return nil, ErrModelTraceConfig
	}
	defer unix.Close(root)
	fd, err := unix.Openat(root, filepath.Base(path), unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err != nil {
		return nil, ErrModelTraceConfig
	}
	file := os.NewFile(uintptr(fd), "modeltrace-input")
	defer file.Close()
	before, err := file.Stat()
	if err != nil || !before.Mode().IsRegular() || before.Size() > maximum {
		return nil, ErrModelTraceConfig
	}
	data, readErr := io.ReadAll(io.LimitReader(file, maximum+1))
	after, statErr := file.Stat()
	if readErr != nil || statErr != nil || int64(len(data)) != before.Size() || after.Size() != before.Size() ||
		!after.ModTime().Equal(before.ModTime()) {
		return nil, ErrModelTraceConfig
	}
	return data, nil
}

func ValidateModelTraceDatabase(path string) error {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || strings.ContainsAny(path, "?\\") {
		return ErrModelTraceConfig
	}
	root, err := modelTraceDirectory(filepath.Dir(path))
	if err != nil {
		return ErrModelTraceConfig
	}
	defer unix.Close(root)
	var parent unix.Stat_t
	if unix.Fstat(root, &parent) != nil || parent.Uid != uint32(os.Geteuid()) || parent.Mode&0077 != 0 {
		return ErrModelTraceConfig
	}
	var info unix.Stat_t
	err = unix.Fstatat(root, filepath.Base(path), &info, unix.AT_SYMLINK_NOFOLLOW)
	if err == unix.ENOENT {
		return nil
	}
	if err != nil || info.Mode&unix.S_IFMT != unix.S_IFREG || info.Uid != uint32(os.Geteuid()) ||
		info.Mode&0077 != 0 || info.Nlink != 1 {
		return ErrModelTraceConfig
	}
	return nil
}

// The advisory lock coordinates startup recovery, not operator bank publication.
func AcquireModelTraceDatabase(path string) (*os.File, error) {
	leasePath := path + ".modeltrace-owner"
	if ValidateModelTraceDatabase(path) != nil || ValidateModelTraceDatabase(leasePath) != nil {
		return nil, ErrModelTraceConfig
	}
	root, err := modelTraceDirectory(filepath.Dir(path))
	if err != nil {
		return nil, ErrModelTraceConfig
	}
	defer unix.Close(root)
	open := func(name string) (int, error) {
		fd, err := unix.Openat(root, name, unix.O_RDWR|unix.O_CREAT|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0600)
		if err != nil {
			return -1, ErrModelTraceConfig
		}
		var info unix.Stat_t
		if unix.Fstat(fd, &info) != nil || info.Mode&unix.S_IFMT != unix.S_IFREG || info.Uid != uint32(os.Geteuid()) ||
			info.Mode&0077 != 0 || info.Nlink != 1 {
			unix.Close(fd)
			return -1, ErrModelTraceConfig
		}
		return fd, nil
	}
	fd, err := open(filepath.Base(leasePath))
	if err != nil {
		return nil, err
	}
	if unix.Flock(fd, unix.LOCK_EX|unix.LOCK_NB) != nil {
		unix.Close(fd)
		return nil, ErrModelTraceConfig
	}
	// A lock on the SQLite inode conflicts with its own locks on Darwin.
	database, err := open(filepath.Base(path))
	if err != nil {
		unix.Close(fd)
		return nil, err
	}
	unix.Close(database)
	return os.NewFile(uintptr(fd), "modeltrace-database-owner"), nil
}

func ModelTracePrivateDirectory(path string) error {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return ErrModelTraceConfig
	}
	root, err := modelTraceDirectory(filepath.Dir(path))
	if err != nil {
		return ErrModelTraceConfig
	}
	defer unix.Close(root)
	if err := unix.Mkdirat(root, filepath.Base(path), 0700); err != nil && err != unix.EEXIST {
		return ErrModelTraceConfig
	}
	fd, err := unix.Openat(root, filepath.Base(path), unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return ErrModelTraceConfig
	}
	defer unix.Close(fd)
	var info unix.Stat_t
	if unix.Fstat(fd, &info) != nil || info.Uid != uint32(os.Geteuid()) || info.Mode&0777 != 0700 {
		return ErrModelTraceConfig
	}
	return nil
}
