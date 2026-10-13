package modeltrace

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

var (
	ErrProcessConfiguration = errors.New("invalid modeltrace process configuration")
	ErrProcessIntegrity     = errors.New("modeltrace integrity check failed")
	ErrProcessFailed        = errors.New("modeltrace worker failed")
	ErrProcessLimit         = errors.New("modeltrace process limit exceeded")
)

type ProcessConfig struct {
	PythonPath            string
	PythonSHA256          string
	WorkerPath            string
	RuntimeManifestPath   string
	RuntimeManifestSHA256 string
	VendorManifestPath    string
	VendorManifestSHA256  string
	BankPath              string
	BankRevision          string
	StateRoot             string
	TempDir               string
	Deadline              time.Duration
	MaxInputBytes         int
	MaxStdoutBytes        int
	MaxStderrBytes        int
}

type ProcessEngine struct{ config ProcessConfig }

func NewProcessEngine(config ProcessConfig) (*ProcessEngine, error) {
	if config.Deadline == 0 {
		config.Deadline = 20 * time.Second
	}
	if config.MaxInputBytes == 0 {
		config.MaxInputBytes = 256 << 10
	}
	if config.MaxStdoutBytes == 0 {
		config.MaxStdoutBytes = 256 << 10
	}
	if config.MaxStderrBytes == 0 {
		config.MaxStderrBytes = 8 << 10
	}
	if config.Deadline <= 0 || config.Deadline > 20*time.Second ||
		config.MaxInputBytes < 1 || config.MaxInputBytes > 256<<10 ||
		config.MaxStdoutBytes < 1 || config.MaxStdoutBytes > 256<<10 ||
		config.MaxStderrBytes < 1 || config.MaxStderrBytes > 8<<10 ||
		!revisionPattern.MatchString(config.PythonSHA256) ||
		!revisionPattern.MatchString(config.RuntimeManifestSHA256) ||
		!revisionPattern.MatchString(config.VendorManifestSHA256) ||
		(config.StateRoot == "" && !revisionPattern.MatchString(config.BankRevision)) ||
		(config.StateRoot != "" && (config.BankPath != "" || config.BankRevision != "")) {
		return nil, ErrProcessConfiguration
	}
	p := &ProcessEngine{config}
	if _, _, err := p.seal(); err != nil {
		return nil, err
	}
	if _, err := p.bank(); err != nil {
		return nil, err
	}
	return p, nil
}

func (p *ProcessEngine) Analyze(ctx context.Context, e Evidence) (Result, error) {
	if err := e.Validate(); err != nil {
		return Result{}, err
	}
	if err := ctx.Err(); err != nil {
		return Result{}, err
	}
	// Copy caller-owned numeric slices before validation, serialization, or child use.
	e.Samples = append([]Sample(nil), e.Samples...)
	for i := range e.Samples {
		numbers := make([]int, len(e.Samples[i].Numbers))
		copy(numbers, e.Samples[i].Numbers)
		e.Samples[i].Numbers = numbers
	}
	files, revision, err := p.seal()
	if err != nil {
		return Result{}, err
	}
	bank, err := p.bank()
	if err != nil {
		return Result{}, err
	}
	if digestBytes(bank) != e.BankRevision {
		return Result{}, ErrProcessIntegrity
	}
	input, err := json.Marshal(struct {
		SchemaVersion int      `json:"schema_version"`
		BankRevision  string   `json:"bank_revision"`
		Samples       []Sample `json:"samples"`
	}{e.SchemaVersion, e.BankRevision, e.Samples})
	if err != nil || len(input) > p.config.MaxInputBytes {
		return Result{}, ErrProcessLimit
	}
	dir, err := os.MkdirTemp(p.config.TempDir, "modeltrace-run-")
	if err != nil {
		return Result{}, ErrProcessFailed
	}
	defer os.RemoveAll(dir)
	runtimeDir := filepath.Join(dir, "modeltrace_runtime")
	if os.Mkdir(runtimeDir, 0700) != nil {
		return Result{}, ErrProcessFailed
	}
	for name, data := range files {
		if os.WriteFile(filepath.Join(runtimeDir, name), data, 0600) != nil {
			return Result{}, ErrProcessFailed
		}
	}
	bankPath := filepath.Join(dir, "bank.json")
	if os.WriteFile(bankPath, bank, 0600) != nil {
		return Result{}, ErrProcessFailed
	}
	runCtx, cancel := context.WithTimeout(ctx, p.config.Deadline)
	defer cancel()
	// -S bypasses .pth and sitecustomize; only the pinned installation's purelib is added.
	bootstrap := "import sys,sysconfig,runpy;sys.path.append(sysconfig.get_path('purelib'));sys.path.insert(0," +
		pythonQuote(dir) + ");runpy.run_module('modeltrace_runtime.worker',run_name='__main__')"
	cmd := exec.CommandContext(runCtx, p.config.PythonPath, "-I", "-S", "-B", "-c", bootstrap)
	cmd.Dir = dir
	cmd.Env = []string{
		"SMART_ROUTER_MODELTRACE_BANK=" + bankPath,
		"PYTHONDONTWRITEBYTECODE=1", "OPENBLAS_NUM_THREADS=1", "OMP_NUM_THREADS=1",
		"MKL_NUM_THREADS=1", "VECLIB_MAXIMUM_THREADS=1", "NUMEXPR_NUM_THREADS=1", "BLIS_NUM_THREADS=1",
		"TMPDIR=" + dir,
	}
	cmd.Stdin = bytes.NewReader(input)
	stdout := &boundedOutput{limit: p.config.MaxStdoutBytes, cancel: cancel}
	stderr := &boundedOutput{limit: p.config.MaxStderrBytes, cancel: cancel}
	cmd.Stdout, cmd.Stderr = stdout, stderr
	cmd.WaitDelay = 250 * time.Millisecond
	err = cmd.Run()
	if stdout.exceeded || stderr.exceeded {
		return Result{}, ErrProcessLimit
	}
	if ctx.Err() != nil {
		return Result{}, ctx.Err()
	}
	if runCtx.Err() != nil {
		return Result{}, context.DeadlineExceeded
	}
	if err != nil {
		return Result{}, ErrProcessFailed
	}
	return projectResult(stdout.data.Bytes(), e, revision)
}

type boundedOutput struct {
	data     bytes.Buffer
	limit    int
	exceeded bool
	cancel   context.CancelFunc
}

func (w *boundedOutput) Write(data []byte) (int, error) {
	if len(data) > w.limit-w.data.Len() {
		w.exceeded = true
		w.cancel()
		return 0, ErrProcessLimit
	}
	return w.data.Write(data)
}

func pythonQuote(value string) string {
	data, _ := json.Marshal(value)
	return string(data)
}

type runtimeManifest struct {
	SchemaVersion int               `json:"schema_version"`
	Files         map[string]string `json:"files"`
}

type vendorManifest struct {
	SchemaVersion int `json:"schema_version"`
	Source        struct {
		URL    string `json:"url"`
		Commit string `json:"commit"`
	} `json:"source"`
	License            json.RawMessage   `json:"license"`
	Archive            json.RawMessage   `json:"archive"`
	Coverage           json.RawMessage   `json:"coverage"`
	DistributionPolicy json.RawMessage   `json:"distribution_policy"`
	Files              map[string]string `json:"files"`
}

func (p *ProcessEngine) seal() (map[string][]byte, string, error) {
	c := p.config
	tempRoot, err := secureDirectory(c.TempDir)
	if err != nil {
		return nil, "", ErrProcessConfiguration
	}
	unix.Close(tempRoot)
	python, err := secureRead(c.PythonPath, 128<<20)
	if err != nil || digestBytes(python) != c.PythonSHA256 {
		return nil, "", ErrProcessIntegrity
	}
	runtimeData, err := secureRead(c.RuntimeManifestPath, 256<<10)
	if err != nil || digestBytes(runtimeData) != c.RuntimeManifestSHA256 {
		return nil, "", ErrProcessIntegrity
	}
	var runtime runtimeManifest
	if decodeJSON(runtimeData, &runtime) != nil || runtime.SchemaVersion != 1 || len(runtime.Files) != 4 {
		return nil, "", ErrProcessIntegrity
	}
	root := filepath.Dir(c.RuntimeManifestPath)
	if c.WorkerPath != filepath.Join(root, "worker.py") {
		return nil, "", ErrProcessConfiguration
	}
	files := make(map[string][]byte)
	for _, name := range []string{"worker.py", "engine.py", "bank_validation.py", "__init__.py"} {
		hash := runtime.Files[name]
		if !revisionPattern.MatchString(hash) {
			return nil, "", ErrProcessIntegrity
		}
		data, err := secureRead(filepath.Join(root, name), 1<<20)
		if err != nil || digestBytes(data) != hash {
			return nil, "", ErrProcessIntegrity
		}
		files[name] = data
	}
	vendorData, err := secureRead(c.VendorManifestPath, 256<<10)
	if err != nil || digestBytes(vendorData) != c.VendorManifestSHA256 {
		return nil, "", ErrProcessIntegrity
	}
	var vendor vendorManifest
	if decodeJSON(vendorData, &vendor) != nil || vendor.SchemaVersion != 1 ||
		vendor.Source.Commit != "6cd4a8ff0f3f4e49d6d6969dd2fbadfa1569fde2" ||
		vendor.Source.URL != "https://github.com/xqy2006/ModelTrace.git" ||
		len(vendor.Files) < 3 || len(vendor.Files) > 256 {
		return nil, "", ErrProcessIntegrity
	}
	for _, required := range []string{"fingerprint.py", "data/unified_bank.json", "LICENSE"} {
		if !revisionPattern.MatchString(vendor.Files[required]) {
			return nil, "", ErrProcessIntegrity
		}
	}
	for name, hash := range vendor.Files {
		if !relativeFile(name) || !revisionPattern.MatchString(hash) {
			return nil, "", ErrProcessIntegrity
		}
		data, err := secureRead(filepath.Join(filepath.Dir(c.VendorManifestPath), name), 16<<20)
		if err != nil || digestBytes(data) != hash {
			return nil, "", ErrProcessIntegrity
		}
	}
	return files, digestBytes(runtimeData), nil
}

func (p *ProcessEngine) bank() ([]byte, error) {
	if p.config.StateRoot != "" {
		return currentBank(p.config.StateRoot)
	}
	data, err := secureRead(p.config.BankPath, 16<<20)
	if err != nil || digestBytes(data) != p.config.BankRevision {
		return nil, ErrProcessIntegrity
	}
	return data, nil
}

type bankEntry struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

func currentBank(root string) ([]byte, error) {
	data, err := secureRead(filepath.Join(root, "current.json"), 256<<10)
	if err != nil {
		return nil, ErrProcessIntegrity
	}
	var manifest struct {
		SchemaVersion int                  `json:"schema_version"`
		Generation    string               `json:"generation"`
		Bank          bankEntry            `json:"bank"`
		State         bankEntry            `json:"state"`
		References    bankEntry            `json:"references"`
		Families      map[string]bankEntry `json:"families"`
	}
	if decodeJSON(data, &manifest) != nil || manifest.SchemaVersion != 1 ||
		!regexp.MustCompile(`^generation-[0-9a-f]{32}$`).MatchString(manifest.Generation) ||
		manifest.Families == nil || len(manifest.Families) > 32 {
		return nil, ErrProcessIntegrity
	}
	prefix := "generations/" + manifest.Generation + "/"
	read := func(entry bankEntry, expected string) ([]byte, error) {
		if entry.Path != prefix+expected || !relativeFile(entry.Path) ||
			!revisionPattern.MatchString(entry.SHA256) {
			return nil, ErrProcessIntegrity
		}
		content, err := secureRead(filepath.Join(root, entry.Path), 16<<20)
		if err != nil || digestBytes(content) != entry.SHA256 {
			return nil, ErrProcessIntegrity
		}
		return content, nil
	}
	bank, err := read(manifest.Bank, "bank.json")
	if err != nil {
		return nil, err
	}
	if _, err = read(manifest.State, "state.json"); err != nil {
		return nil, err
	}
	if _, err = read(manifest.References, "references.jsonl"); err != nil {
		return nil, err
	}
	for family, entry := range manifest.Families {
		if !labelPattern.MatchString(family) {
			return nil, ErrProcessIntegrity
		}
		if _, err = read(entry, "families/"+family+".json"); err != nil {
			return nil, err
		}
	}
	return bank, nil
}

func relativeFile(name string) bool {
	if name == "" || filepath.IsAbs(name) || filepath.Clean(name) != name || strings.Contains(name, "\\") {
		return false
	}
	for _, part := range strings.Split(name, "/") {
		if part == "" || part == "." || part == ".." {
			return false
		}
	}
	return true
}

// Walk pinned directory handles, rejecting symlinks at every level and on the file.
func secureDirectory(path string) (int, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return -1, ErrProcessIntegrity
	}
	root, err := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err != nil {
		return -1, ErrProcessIntegrity
	}
	if path == "/" {
		return root, nil
	}
	for _, part := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		next, err := unix.Openat(root, part, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
		unix.Close(root)
		if err != nil {
			return -1, ErrProcessIntegrity
		}
		root = next
	}
	return root, nil
}

func secureRead(path string, maximum int64) ([]byte, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return nil, ErrProcessIntegrity
	}
	root, err := secureDirectory(filepath.Dir(path))
	if err != nil {
		return nil, err
	}
	defer unix.Close(root)
	name := filepath.Base(path)
	fd, err := unix.Openat(root, name, unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err != nil {
		return nil, ErrProcessIntegrity
	}
	file := os.NewFile(uintptr(fd), name)
	defer file.Close()
	opened, err := file.Stat()
	if err != nil || !opened.Mode().IsRegular() || opened.Size() > maximum {
		return nil, ErrProcessIntegrity
	}
	data, err := io.ReadAll(io.LimitReader(file, maximum+1))
	after, statErr := file.Stat()
	if err != nil || statErr != nil || len(data) > int(maximum) || int64(len(data)) != opened.Size() ||
		after.Size() != opened.Size() || !after.ModTime().Equal(opened.ModTime()) {
		return nil, ErrProcessIntegrity
	}
	return data, nil
}
