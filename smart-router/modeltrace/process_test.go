package modeltrace

import (
	"context"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

func TestProcessBridgeRetainsGo123Compatibility(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "process.go", nil, 0)
	if err != nil {
		t.Fatal("source inspection failed")
	}
	ast.Inspect(file, func(node ast.Node) bool {
		selector, ok := node.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		pkg, ok := selector.X.(*ast.Ident)
		if ok && pkg.Name == "os" && (selector.Sel.Name == "Root" || selector.Sel.Name == "OpenRoot") {
			t.Error("bridge requires post-Go1.23 filesystem API")
		}
		return true
	})
}

const pinnedPython = "/Users/bytedance/.local/share/mise/installs/python/3.14.7/bin/python3.14"
const ownedTestRoot = "/Users/bytedance/.local/share/modeltrace-evidence-20261013/task5-implementation/tmp"

func ownedDir(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp(ownedTestRoot, "bridge-")
	if err != nil {
		t.Fatal("owned temporary directory unavailable")
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return dir
}

func put(t *testing.T, path string, data []byte) {
	t.Helper()
	if os.MkdirAll(filepath.Dir(path), 0700) != nil || os.WriteFile(path, data, 0600) != nil {
		t.Fatal("fixture write failed")
	}
}

func putJSON(t *testing.T, path string, value any) []byte {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal("fixture encode failed")
	}
	put(t, path, data)
	return data
}

func processFixture(t *testing.T, body string) (ProcessConfig, Evidence, string) {
	t.Helper()
	root := ownedDir(t)
	body = strings.ReplaceAll(body, "MARKER_PATH", strconvQuote(filepath.Join(root, "launched")))
	runtimeRoot := filepath.Join(root, "modeltrace_runtime")
	files := make(map[string]string)
	for _, name := range []string{"__init__.py", "bank_validation.py", "engine.py", "worker.py"} {
		data := []byte("")
		if name == "worker.py" {
			data = []byte(body)
		}
		put(t, filepath.Join(runtimeRoot, name), data)
		files[name] = digestBytes(data)
	}
	runtimeData := putJSON(t, filepath.Join(runtimeRoot, "RUNTIME-MANIFEST.json"),
		map[string]any{"schema_version": 1, "files": files})
	vendor := filepath.Join(root, "vendor")
	vendorFiles := map[string]string{}
	for _, name := range []string{"fingerprint.py", "data/unified_bank.json", "LICENSE"} {
		data := []byte("{}")
		put(t, filepath.Join(vendor, name), data)
		vendorFiles[name] = digestBytes(data)
	}
	vendorData := putJSON(t, filepath.Join(vendor, "PROVENANCE.json"), map[string]any{
		"schema_version": 1, "source": map[string]string{"url": "https://github.com/xqy2006/ModelTrace.git",
			"commit": "6cd4a8ff0f3f4e49d6d6969dd2fbadfa1569fde2"}, "files": vendorFiles,
	})
	python, err := os.ReadFile(pinnedPython)
	if err != nil {
		t.Fatal("pinned interpreter unavailable")
	}
	bankPath := filepath.Join(root, "bank.json")
	put(t, bankPath, []byte("{}"))
	e := validEvidence()
	e.BankRevision = digestBytes([]byte("{}"))
	return ProcessConfig{
		PythonPath: pinnedPython, PythonSHA256: digestBytes(python),
		WorkerPath:            filepath.Join(runtimeRoot, "worker.py"),
		RuntimeManifestPath:   filepath.Join(runtimeRoot, "RUNTIME-MANIFEST.json"),
		RuntimeManifestSHA256: digestBytes(runtimeData),
		VendorManifestPath:    filepath.Join(vendor, "PROVENANCE.json"),
		VendorManifestSHA256:  digestBytes(vendorData),
		BankPath:              bankPath, BankRevision: e.BankRevision, TempDir: root,
	}, e, filepath.Join(root, "launched")
}

func TestProcessConfigurationAndIntegrityBeforeLaunch(t *testing.T) {
	cases := []struct {
		name string
		edit func(*testing.T, *ProcessConfig)
	}{
		{"relative", func(t *testing.T, c *ProcessConfig) { c.WorkerPath = "worker.py" }},
		{"wrong_runtime_hash", func(t *testing.T, c *ProcessConfig) { c.RuntimeManifestSHA256 = strings.Repeat("0", 64) }},
		{"wrong_vendor_hash", func(t *testing.T, c *ProcessConfig) { c.VendorManifestSHA256 = strings.Repeat("0", 64) }},
		{"wrong_python_hash", func(t *testing.T, c *ProcessConfig) { c.PythonSHA256 = strings.Repeat("0", 64) }},
		{"wrong_bank_hash", func(t *testing.T, c *ProcessConfig) { c.BankRevision = strings.Repeat("0", 64) }},
		{"worker_mutation", func(t *testing.T, c *ProcessConfig) { put(t, c.WorkerPath, []byte("raise SystemExit(0)")) }},
		{"vendor_mutation", func(t *testing.T, c *ProcessConfig) {
			put(t, filepath.Join(filepath.Dir(c.VendorManifestPath), "fingerprint.py"), []byte("changed"))
		}},
		{"symlink", func(t *testing.T, c *ProcessConfig) {
			link := filepath.Join(c.TempDir, "alias.py")
			if os.Symlink(c.WorkerPath, link) != nil {
				t.Fatal("fixture symlink failed")
			}
			c.WorkerPath = link
		}},
		{"limit", func(t *testing.T, c *ProcessConfig) { c.MaxStdoutBytes = 256<<10 + 1 }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, _, marker := processFixture(t, "open(MARKER_PATH,'w').close()")
			tc.edit(t, &c)
			if _, err := NewProcessEngine(c); err == nil {
				t.Error("unsafe configuration admitted")
			}
			if _, err := os.Stat(marker); !os.IsNotExist(err) {
				t.Error("child launched during configuration rejection")
			}
		})
	}
}

func strconvQuote(s string) string {
	data, _ := json.Marshal(s)
	return string(data)
}

func TestProcessExecutesControlledChild(t *testing.T) {
	e := validEvidence()
	e.BankRevision = digestBytes([]byte("{}"))
	body := "import sys,json,os\nr=json.load(sys.stdin)\n" +
		"assert set(r)=={'schema_version','bank_revision','samples'}\n" +
		"assert 'PYTHONPATH' not in os.environ and 'BRIDGE_PRIVATE' not in os.environ\n" +
		"sys.stdout.write(" + strconvQuote(string(wireResult(e))) + ")\n"
	c, e, _ := processFixture(t, body)
	t.Setenv("BRIDGE_PRIVATE", "never-inherit")
	t.Setenv("PYTHONPATH", c.TempDir)
	p, err := NewProcessEngine(c)
	if err != nil {
		t.Fatal("controlled constructor failed")
	}
	r, err := p.Analyze(context.Background(), e)
	if err != nil || r.Validate() != nil || r.UsedOutputs != 1 {
		t.Fatal("controlled worker did not produce a typed result")
	}
}

func TestProcessBoundedFailures(t *testing.T) {
	for _, tc := range []struct{ name, body string }{
		{"huge_stdout", "import sys\nsys.stdout.write('x'*300000)\n"},
		{"huge_stderr", "import sys\nsys.stderr.write('x'*20000)\n"},
		{"malformed", "print('{')\n"},
		{"stderr", "import sys\nsys.stderr.write('PRIVATE_STDERR_SENTINEL')\nraise SystemExit(1)\n"},
		{"deadline", "import time\ntime.sleep(30)\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, e, _ := processFixture(t, tc.body)
			c.Deadline = 300 * time.Millisecond
			p, err := NewProcessEngine(c)
			if err != nil {
				t.Fatal("controlled constructor failed")
			}
			start := time.Now()
			_, err = p.Analyze(context.Background(), e)
			if err == nil {
				t.Error("unsafe child response admitted")
			}
			if err != nil && (strings.Contains(err.Error(), "SENTINEL") || strings.Contains(err.Error(), c.TempDir)) {
				t.Error("private child error exposed")
			}
			if time.Since(start) > 3*time.Second {
				t.Error("child not bounded by deadline")
			}
		})
	}
}

func publishFixture(t *testing.T, root, generation string, bank []byte) map[string]any {
	t.Helper()
	prefix := "generations/" + generation + "/"
	entries := map[string]any{}
	for _, name := range []string{"bank.json", "state.json", "references.jsonl", "families/family-a.json"} {
		data := []byte("{}")
		if name == "bank.json" {
			data = bank
		}
		put(t, filepath.Join(root, prefix, name), data)
		entries[name] = map[string]string{"path": prefix + name, "sha256": digestBytes(data)}
	}
	manifest := map[string]any{
		"schema_version": 1, "generation": generation, "bank": entries["bank.json"],
		"state": entries["state.json"], "references": entries["references.jsonl"],
		"families": map[string]any{"family-a": entries["families/family-a.json"]},
	}
	putJSON(t, filepath.Join(root, "current.json"), manifest)
	return manifest
}

func TestBankManifestTraversalFailsBeforeChildLaunch(t *testing.T) {
	c, _, marker := processFixture(t, "open(MARKER_PATH,'w').close()")
	c.BankPath, c.BankRevision = "", ""
	c.StateRoot = filepath.Join(c.TempDir, "state")
	manifest := publishFixture(t, c.StateRoot, "generation-"+strings.Repeat("a", 32), []byte("{}"))
	manifest["bank"] = map[string]string{"path": "../bank.json", "sha256": digestBytes([]byte("{}"))}
	putJSON(t, filepath.Join(c.StateRoot, "current.json"), manifest)
	if _, err := NewProcessEngine(c); err == nil {
		t.Error("bank traversal manifest admitted")
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Error("child launched on bank traversal")
	}
}

func TestProcessManifestsRejectJSONFieldAliases(t *testing.T) {
	for _, tc := range []struct{ name, manifest, from, to string }{
		{"runtime_schema", "runtime", `"schema_version":1`, `"schema_version":1,"SCHEMA_VERSION":1`},
		{"runtime_files", "runtime", `"files":`, `"FILES":{}, "files":`},
		{"vendor_source", "vendor", `"source":`, `"SOURCE":{}, "source":`},
		{"vendor_nested_commit", "vendor", `"commit":`, `"COMMIT":"other","commit":`},
		{"vendor_files", "vendor", `"files":`, `"Files":{}, "files":`},
		{"current_generation", "current", `"generation":`, `"GENERATION":"other","generation":`},
		{"current_bank", "current", `"bank":`, `"BANK":{}, "bank":`},
		{"current_nested_path", "current", `"path":`, `"PATH":"other","path":`},
		{"current_family_entry", "current", `"sha256":`, `"SHA256":"other","sha256":`},
		{"current_families", "current", `"families":`, `"FAMILIES":{}, "families":`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _, marker := processFixture(t, "open(MARKER_PATH,'w').close()")
			manifestPath := c.RuntimeManifestPath
			switch tc.manifest {
			case "vendor":
				manifestPath = c.VendorManifestPath
			case "current":
				c.BankPath, c.BankRevision = "", ""
				c.StateRoot = filepath.Join(c.TempDir, "state")
				publishFixture(t, c.StateRoot, "generation-"+strings.Repeat("a", 32), []byte("{}"))
				manifestPath = filepath.Join(c.StateRoot, "current.json")
			}
			data, err := os.ReadFile(manifestPath)
			if err != nil || !strings.Contains(string(data), tc.from) {
				t.Fatal("manifest alias fixture unavailable")
			}
			replacements := 1
			if tc.name == "current_family_entry" {
				replacements = -1
			}
			data = []byte(strings.Replace(string(data), tc.from, tc.to, replacements))
			put(t, manifestPath, data)
			switch tc.manifest {
			case "runtime":
				c.RuntimeManifestSHA256 = digestBytes(data)
			case "vendor":
				c.VendorManifestSHA256 = digestBytes(data)
			}
			if _, err := NewProcessEngine(c); err != ErrProcessIntegrity {
				t.Fatalf("manifest JSON field alias admitted: error=%v", err)
			}
			if _, err := os.Stat(marker); !os.IsNotExist(err) {
				t.Fatal("manifest alias rejection launched child")
			}
		})
	}
}

func TestProcessManifestsPreserveDynamicKeys(t *testing.T) {
	t.Run("vendor_files_and_opaque", func(t *testing.T) {
		c, _, _ := processFixture(t, "")
		data, err := os.ReadFile(c.VendorManifestPath)
		var manifest vendorManifest
		if err != nil || decodeJSON(data, &manifest) != nil {
			t.Fatal("canonical vendor manifest rejected")
		}
		for _, name := range []string{"Files", "files", "\u6a21\u578b.py"} {
			content := []byte("{}")
			put(t, filepath.Join(filepath.Dir(c.VendorManifestPath), name), content)
			manifest.Files[name] = digestBytes(content)
		}
		manifest.License = json.RawMessage(`{"Files":1,"files":2,"\u6a21":3,"nested":[{"PATH":null}]}`)
		c.VendorManifestSHA256 = digestBytes(putJSON(t, c.VendorManifestPath, manifest))
		if _, err := NewProcessEngine(c); err != nil {
			t.Fatalf("dynamic vendor keys or opaque content rejected: %v", err)
		}
	})
	t.Run("current_families", func(t *testing.T) {
		c, _, _ := processFixture(t, "")
		c.BankPath, c.BankRevision = "", ""
		c.StateRoot = filepath.Join(c.TempDir, "state")
		generation := "generation-" + strings.Repeat("a", 32)
		manifest := publishFixture(t, c.StateRoot, generation, []byte("{}"))
		families := manifest["families"].(map[string]any)
		for _, name := range []string{"Families", "families"} {
			entryPath := "generations/" + generation + "/families/" + name + ".json"
			put(t, filepath.Join(c.StateRoot, entryPath), []byte("{}"))
			families[name] = map[string]string{"path": entryPath, "sha256": digestBytes([]byte("{}"))}
		}
		putJSON(t, filepath.Join(c.StateRoot, "current.json"), manifest)
		if _, err := NewProcessEngine(c); err != nil {
			t.Fatalf("case-distinct dynamic family keys rejected: %v", err)
		}
	})
}

func TestBankPublicationAffectsOnlyNextSubmission(t *testing.T) {
	body := "import sys,json,os,time\nrequest=json.load(sys.stdin)\n" +
		"open(MARKER_PATH,'w').close()\n" +
		"while not os.path.exists(MARKER_PATH+'.release'): time.sleep(.01)\n" +
		"result=json.loads(" + strconvQuote(string(wireResult(validEvidence()))) + ")\n" +
		"result['bank_revision']=request['bank_revision']\nprint(json.dumps(result))\n"
	c, e, marker := processFixture(t, body)
	c.BankPath, c.BankRevision = "", ""
	c.StateRoot = filepath.Join(c.TempDir, "state")
	oldBank, newBank := []byte(`{"version":1}`), []byte(`{"version":2}`)
	publishFixture(t, c.StateRoot, "generation-"+strings.Repeat("a", 32), oldBank)
	e.BankRevision = digestBytes(oldBank)
	p, err := NewProcessEngine(c)
	if err != nil {
		t.Fatal("current-generation constructor failed")
	}
	type outcome struct {
		r   Result
		err error
	}
	done := make(chan outcome, 1)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	go func() { r, err := p.Analyze(ctx, e); done <- outcome{r, err} }()
	start := time.Now()
	for {
		if _, err := os.Stat(marker); err == nil {
			break
		}
		select {
		case <-done:
			t.Fatal("current bank snapshot not submitted")
		default:
		}
		if time.Since(start) > time.Second {
			cancel()
			<-done
			t.Fatal("child launch not observed")
		}
		time.Sleep(10 * time.Millisecond)
	}
	publishFixture(t, c.StateRoot, "generation-"+strings.Repeat("b", 32), newBank)
	put(t, marker+".release", nil)
	first := <-done
	if first.err != nil || first.r.BankRevision != digestBytes(oldBank) {
		t.Fatal("publication altered an in-flight bank revision")
	}
	e.BankRevision = digestBytes(newBank)
	second, err := p.Analyze(context.Background(), e)
	if err != nil || second.BankRevision != e.BankRevision {
		t.Error("next request used stale bank")
	}
}

func TestOldProbeKeepsItsOriginalBankRevision(t *testing.T) {
	c, e, marker := processFixture(t, "open(MARKER_PATH,'w').close()")
	c.BankPath, c.BankRevision = "", ""
	c.StateRoot = filepath.Join(c.TempDir, "state")
	publishFixture(t, c.StateRoot, "generation-"+strings.Repeat("a", 32), []byte("{}"))
	p, err := NewProcessEngine(c)
	if err != nil {
		t.Fatal("current-generation constructor failed")
	}
	publishFixture(t, c.StateRoot, "generation-"+strings.Repeat("b", 32), []byte(`{"next":1}`))
	before := e.BankRevision
	if _, err := p.Analyze(context.Background(), e); err == nil {
		t.Error("old evidence silently upgraded")
	}
	if e.BankRevision != before {
		t.Error("caller revision rewritten")
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Error("stale revision launched child")
	}
}

func TestProcessCancelReapsChildAndCleansSnapshot(t *testing.T) {
	c, e, marker := processFixture(t, "import os,time\nopen(MARKER_PATH,'w').write(str(os.getpid()))\ntime.sleep(30)\n")
	p, err := NewProcessEngine(c)
	if err != nil {
		t.Fatal("controlled constructor failed")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { _, err := p.Analyze(ctx, e); done <- err }()
	var pid int
	start := time.Now()
	for {
		data, readErr := os.ReadFile(marker)
		if readErr == nil && json.Unmarshal(data, &pid) == nil && pid > 0 {
			break
		}
		if time.Since(start) > time.Second {
			cancel()
			<-done
			t.Fatal("child start not observed")
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	if err := <-done; err != context.Canceled {
		t.Error("cancel did not return stable context error")
	}
	if unix.Kill(pid, 0) != unix.ESRCH {
		t.Error("owned child was not reaped")
	}
	entries, err := os.ReadDir(c.TempDir)
	if err != nil {
		t.Fatal("cleanup inspection failed")
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "modeltrace-run-") {
			t.Error("execution snapshot leaked")
		}
	}
}

func TestProcessRejectsPostConstructorMutationAndNonRegularFiles(t *testing.T) {
	for _, mode := range []string{"mutation", "fifo", "directory", "parent_symlink", "traversal", "runtime_omission"} {
		t.Run(mode, func(t *testing.T) {
			c, e, marker := processFixture(t, "open(MARKER_PATH,'w').close()")
			p, err := NewProcessEngine(c)
			if err != nil {
				t.Fatal("controlled constructor failed")
			}
			switch mode {
			case "mutation":
				put(t, c.WorkerPath, []byte("print('changed')"))
			case "fifo":
				if os.Remove(c.WorkerPath) != nil || unix.Mkfifo(c.WorkerPath, 0600) != nil {
					t.Fatal("FIFO fixture failed")
				}
			case "directory":
				if os.Remove(c.WorkerPath) != nil || os.Mkdir(c.WorkerPath, 0700) != nil {
					t.Fatal("directory fixture failed")
				}
			case "parent_symlink":
				dir := filepath.Dir(c.WorkerPath)
				if os.Rename(dir, dir+"-real") != nil || os.Symlink(dir+"-real", dir) != nil {
					t.Fatal("parent symlink fixture failed")
				}
			case "traversal", "runtime_omission":
				var manifest runtimeManifest
				data, _ := os.ReadFile(c.RuntimeManifestPath)
				if json.Unmarshal(data, &manifest) != nil {
					t.Fatal("manifest fixture failed")
				}
				if mode == "traversal" {
					manifest.Files["../worker.py"] = manifest.Files["worker.py"]
				} else {
					delete(manifest.Files, "engine.py")
				}
				p.config.RuntimeManifestSHA256 = digestBytes(putJSON(t, c.RuntimeManifestPath, manifest))
			}
			start := time.Now()
			if _, err := p.Analyze(context.Background(), e); err == nil {
				t.Error("integrity mutation admitted")
			}
			if time.Since(start) > time.Second {
				t.Error("non-regular file blocked admission")
			}
			if _, err := os.Stat(marker); !os.IsNotExist(err) {
				t.Error("integrity failure launched child")
			}
		})
	}
}

func TestRealPythonBridgeMatchesVendorOracle(t *testing.T) {
	realPythonBridgeMatchesVendorOracle(t, false)
}

func TestRealPythonBridgeSafeCustomModelLabels(t *testing.T) {
	realPythonBridgeMatchesVendorOracle(t, true)
}

func TestActualBridgePreservesEmptyShortSample(t *testing.T) {
	repo, err := filepath.Abs("..")
	if err != nil {
		t.Fatal("repository location unavailable")
	}
	hashFile := func(path string) string {
		data, err := secureRead(path, 128<<20)
		if err != nil {
			t.Fatal("pinned bridge resource unavailable")
		}
		return digestBytes(data)
	}
	runtimeRoot := filepath.Join(repo, "modeltrace_runtime")
	vendorRoot := filepath.Join(repo, "third_party", "modeltrace")
	c := ProcessConfig{
		PythonPath: pinnedPython, PythonSHA256: hashFile(pinnedPython),
		WorkerPath:            filepath.Join(runtimeRoot, "worker.py"),
		RuntimeManifestPath:   filepath.Join(runtimeRoot, "RUNTIME-MANIFEST.json"),
		RuntimeManifestSHA256: hashFile(filepath.Join(runtimeRoot, "RUNTIME-MANIFEST.json")),
		VendorManifestPath:    filepath.Join(vendorRoot, "PROVENANCE.json"),
		VendorManifestSHA256:  hashFile(filepath.Join(vendorRoot, "PROVENANCE.json")),
		BankPath:              filepath.Join(vendorRoot, "data", "unified_bank.json"),
		BankRevision:          hashFile(filepath.Join(vendorRoot, "data", "unified_bank.json")),
		TempDir:               ownedDir(t),
	}
	p, err := NewProcessEngine(c)
	if err != nil {
		t.Fatalf("real bridge constructor rejected pinned artifacts: %v", err)
	}
	first := validEvidence().Samples[0]
	second := validEvidence().Samples[0]
	second.ChallengeID = "slot-2"
	for i := range second.Numbers {
		second.Numbers[i] += 80
	}
	empty := Sample{"empty", 0, []int{}}
	for _, tc := range []struct {
		name    string
		samples []Sample
		used    int
	}{
		{"one_valid_plus_empty", []Sample{first, empty}, 1},
		{"empty_first", []Sample{empty, first, second}, 2},
		{"empty_middle", []Sample{first, empty, second}, 2},
		{"empty_last", []Sample{first, second, empty}, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e := validEvidence()
			e.BankRevision, e.Samples = c.BankRevision, tc.samples
			before, err := json.Marshal(e)
			if err != nil || e.Validate() != nil {
				t.Fatal("legal empty-short evidence fixture rejected")
			}
			var decoded Evidence
			if err := json.Unmarshal(before, &decoded); err != nil || decoded.Validate() != nil {
				t.Fatal("legal empty-short JSON fixture rejected")
			}
			r, err := p.Analyze(context.Background(), decoded)
			if err != nil {
				t.Fatalf("actual bridge rejected legal empty short sample: %v", err)
			}
			if r.Validate() != nil || r.UsedOutputs != tc.used || r.Complete || r.Assessment != "inconclusive" {
				t.Fatalf("empty short sample changed partial result: used=%d complete=%t assessment=%s",
					r.UsedOutputs, r.Complete, r.Assessment)
			}
			after, err := json.Marshal(decoded)
			if err != nil || string(before) != string(after) {
				t.Fatal("bridge changed caller sample order or numbers")
			}
		})
	}
	t.Run("all_invalid", func(t *testing.T) {
		e := validEvidence()
		e.BankRevision = c.BankRevision
		e.Samples = []Sample{empty, {"short", 0, []int{1}}}
		if _, err := p.Analyze(context.Background(), e); err != ErrInvalidEvidence {
			t.Fatalf("all-short samples must remain rejected: %v", err)
		}
	})
	t.Run("incoming_null", func(t *testing.T) {
		e := validEvidence()
		e.Samples = append(e.Samples, Sample{"null", 0, nil})
		data, err := json.Marshal(e)
		if err != nil {
			t.Fatal(err)
		}
		var decoded Evidence
		if err := json.Unmarshal(data, &decoded); err != ErrInvalidEvidence {
			t.Fatalf("incoming null numbers must remain rejected: %v", err)
		}
	})
}

func realPythonBridgeMatchesVendorOracle(t *testing.T, custom bool) {
	t.Helper()
	repo, err := filepath.Abs("..")
	if err != nil {
		t.Fatal("repository location unavailable")
	}
	hashFile := func(path string) string {
		data, err := secureRead(path, 128<<20)
		if err != nil {
			t.Fatal("pinned parity resource unavailable")
		}
		return digestBytes(data)
	}
	root := ownedDir(t)
	runtimeRoot := filepath.Join(repo, "modeltrace_runtime")
	vendorRoot := filepath.Join(repo, "third_party", "modeltrace")
	c := ProcessConfig{
		PythonPath: pinnedPython, PythonSHA256: hashFile(pinnedPython),
		WorkerPath:            filepath.Join(runtimeRoot, "worker.py"),
		RuntimeManifestPath:   filepath.Join(runtimeRoot, "RUNTIME-MANIFEST.json"),
		RuntimeManifestSHA256: hashFile(filepath.Join(runtimeRoot, "RUNTIME-MANIFEST.json")),
		VendorManifestPath:    filepath.Join(vendorRoot, "PROVENANCE.json"),
		VendorManifestSHA256:  hashFile(filepath.Join(vendorRoot, "PROVENANCE.json")),
		BankPath:              filepath.Join(vendorRoot, "data", "unified_bank.json"),
		BankRevision:          hashFile(filepath.Join(vendorRoot, "data", "unified_bank.json")),
		TempDir:               root,
	}
	if custom {
		data, err := secureRead(c.BankPath, 16<<20)
		if err != nil {
			t.Fatal("custom bank fixture source unavailable")
		}
		var bank map[string]json.RawMessage
		var models []map[string]json.RawMessage
		var robust map[string]json.RawMessage
		if json.Unmarshal(data, &bank) != nil || json.Unmarshal(bank["models"], &models) != nil ||
			json.Unmarshal(bank["robust"], &robust) != nil {
			t.Fatal("custom bank fixture decode failed")
		}
		order := make([]string, len(models))
		for i, model := range models {
			order[i] = fmt.Sprintf("org/model-%d", i)
			if i%2 == 1 {
				order[i] = "org/" + strings.Repeat("\u6a21", 250) + fmt.Sprint(i)
			}
			model["id"], _ = json.Marshal(order[i])
		}
		// Only IDs and their matching order change; all numeric metrics stay intact.
		bank["models"], _ = json.Marshal(models)
		robust["model_order"], _ = json.Marshal(order)
		bank["robust"], _ = json.Marshal(robust)
		c.BankPath = filepath.Join(root, "custom-bank.json")
		c.BankRevision = digestBytes(putJSON(t, c.BankPath, bank))
	}
	p, err := NewProcessEngine(c)
	if err != nil {
		t.Fatal("real bridge constructor rejected pinned artifacts")
	}
	for _, family := range []string{"gpt", "claude"} {
		t.Run(family, func(t *testing.T) {
			// Oracle runs sealed vendor source, not the port being checked.
			source, err := secureRead(filepath.Join(vendorRoot, "fingerprint.py"), 1<<20)
			if err != nil {
				t.Fatal("oracle source unavailable")
			}
			put(t, filepath.Join(root, "fingerprint.py"), source)
			bank, err := secureRead(c.BankPath, 16<<20)
			if err != nil {
				t.Fatal("oracle bank unavailable")
			}
			put(t, filepath.Join(root, "oracle-bank.json"), bank)
			rows, err := secureRead(filepath.Join(vendorRoot, "data", family+"_reference.jsonl"), 16<<20)
			if err != nil {
				t.Fatal("oracle rows unavailable")
			}
			put(t, filepath.Join(root, "rows.jsonl"), rows)
			code := "import sys,sysconfig,runpy,json,itertools\n" +
				"sys.path.append(sysconfig.get_path('purelib'))\n" +
				"f=runpy.run_path(" + pythonQuote(filepath.Join(root, "fingerprint.py")) + ")\n" +
				"bank=json.load(open(" + pythonQuote(filepath.Join(root, "oracle-bank.json")) + "))\n" +
				"rows=[json.loads(x) for x in itertools.islice(open(" + pythonQuote(filepath.Join(root, "rows.jsonl")) + "),3)]\n" +
				"samples=[{'challenge_id':'slot-'+str(i),'expected_count':r['requested_count'],'numbers':f['parse_numbers'](r['text'])} for i,r in enumerate(rows)]\n" +
				"results=[f['analyze_global_outputs']([{'text':r['text'],'expected_count':r['requested_count']} for r in rows[:n]],bank) for n in (1,2,3)]\n" +
				"print(json.dumps({'samples':samples,'results':results},allow_nan=False))\n"
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, pinnedPython, "-I", "-S", "-B", "-c", code)
			cmd.Dir = root
			cmd.Env = []string{"OPENBLAS_NUM_THREADS=1", "OMP_NUM_THREADS=1", "MKL_NUM_THREADS=1",
				"VECLIB_MAXIMUM_THREADS=1", "NUMEXPR_NUM_THREADS=1", "BLIS_NUM_THREADS=1",
				"PYTHONDONTWRITEBYTECODE=1", "TMPDIR=" + root}
			output := &boundedOutput{limit: 256 << 10, cancel: cancel}
			errors := &boundedOutput{limit: 8 << 10, cancel: cancel}
			cmd.Stdout, cmd.Stderr = output, errors
			if cmd.Run() != nil {
				t.Fatal("pinned oracle execution failed")
			}
			var oracle struct {
				Samples []Sample `json:"samples"`
				Results []struct {
					Prediction  string        `json:"prediction"`
					Probability float64       `json:"probability"`
					Models      []ModelScore  `json:"results"`
					Families    []FamilyScore `json:"family_probabilities"`
				} `json:"results"`
			}
			if json.Unmarshal(output.data.Bytes(), &oracle) != nil || len(oracle.Results) != 3 {
				t.Fatal("oracle projection failed")
			}
			for n := 1; n <= 3; n++ {
				e := validEvidence()
				e.BankRevision, e.Samples = c.BankRevision, oracle.Samples[:n]
				want := oracle.Results[n-1]
				if custom {
					e.ClaimedModel = "absent-model"
					r, err := p.Analyze(context.Background(), e)
					if err != nil || r.Validate() != nil || r.Assessment != "inconclusive" {
						t.Errorf("custom bank absent claim bridge rejected: outputs=%d error=%v", n, err)
					}
				}
				e.ClaimedModel = oracle.Results[n-1].Prediction
				r, err := p.Analyze(context.Background(), e)
				if err != nil || r.Prediction != want.Prediction || r.UsedOutputs != n ||
					r.Complete != (n == 3) || !r.ClosedSet || math.Abs(r.Probability-want.Probability) > 1e-10 ||
					len(r.Models) != len(want.Models) || len(r.Families) != len(want.Families) {
					t.Fatal("real bridge parity mismatch")
				}
				for i, score := range r.Models {
					w := want.Models[i]
					if score.Model != w.Model || score.Family != w.Family ||
						math.Abs(score.Probability-w.Probability) > 1e-10 ||
						math.Abs(score.Score-w.Score) > 1e-10 ||
						math.Abs(score.ProfileSimilarity-w.ProfileSimilarity) > 1e-10 {
						t.Fatal("model metric parity mismatch")
					}
				}
				for i, score := range r.Families {
					w := want.Families[i]
					if score.Family != w.Family || math.Abs(score.Probability-w.Probability) > 1e-10 {
						t.Fatal("family probability parity mismatch")
					}
				}
				if custom {
					expected := "inconclusive"
					if n == 3 && want.Probability >= .9 {
						expected = "matched"
					}
					if r.Assessment != expected {
						t.Error("custom claimed model assessment incorrect")
					}
					if n == 3 {
						if expected != "matched" {
							t.Fatal("complete custom oracle fixture is not conclusive")
						}
						e.ClaimedModel = want.Models[len(want.Models)-1].Model
						other, err := p.Analyze(context.Background(), e)
						if err != nil || other.Assessment != "mismatched" {
							t.Fatal("complete non-predicted custom claim assessment incorrect")
						}
					}
					t.Logf("custom oracle parity: outputs=%d assessment=%s probability=%.12g", n, r.Assessment, r.Probability)
				}
			}
		})
	}
}
