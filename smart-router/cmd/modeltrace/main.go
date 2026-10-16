package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"smart-router/config"
	"smart-router/modeltrace"
	"smart-router/modeltraceapi"
	"strconv"
	"time"
)

// Release provisioning supplies independent, platform-specific reviewed pins.
var releasePythonSHA256, releaseRuntimeSHA256, releaseVendorSHA256 string

var cliProbeID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)

func run(ctx context.Context, args []string, lookup func(string) string, pins config.ModelTracePins, stdout, stderr io.Writer) int {
	fail := func(code string) int {
		_, _ = io.WriteString(stderr, "modeltrace: "+code+"\n")
		return 1
	}
	if len(args) == 0 {
		return fail("invalid_request")
	}
	flags := flag.NewFlagSet(args[0], flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	var input, python, bank, runtime, vendor, address, id string
	switch args[0] {
	case "analyze":
		flags.StringVar(&input, "input", "", "")
		flags.StringVar(&python, "python", "", "")
		flags.StringVar(&bank, "bank", "", "")
		flags.StringVar(&runtime, "runtime-manifest", "", "")
		flags.StringVar(&vendor, "vendor-manifest", "", "")
	case "submit":
		flags.StringVar(&input, "input", "", "")
		flags.StringVar(&address, "url", "", "")
	case "get":
		flags.StringVar(&id, "probe-id", "", "")
		flags.StringVar(&address, "url", "", "")
	default:
		return fail("invalid_request")
	}
	if flags.Parse(args[1:]) != nil || flags.NArg() != 0 {
		return fail("invalid_request")
	}
	count := 0
	flags.Visit(func(*flag.Flag) { count++ })
	if len(args)-1 != count*2 || (args[0] == "analyze" && count != 5) || (args[0] != "analyze" && count != 2) ||
		(args[0] != "get" && (input == "" || input == "-")) || (args[0] == "get" && !cliProbeID.MatchString(id)) {
		return fail("invalid_request")
	}
	var evidence modeltrace.Evidence
	var body []byte
	if args[0] != "get" {
		absolute, err := filepath.Abs(input)
		if err != nil {
			return fail("invalid_request")
		}
		input = absolute
		body, err = config.ReadModelTraceFile(input, modeltraceapi.MaxBodyBytes)
		if err != nil {
			return fail("invalid_request")
		}
		evidence, err = modeltraceapi.DecodeEvidence(body)
		if err != nil {
			return fail("invalid_request")
		}
	}
	var projection []byte
	if args[0] == "analyze" {
		paths := []*string{&python, &bank, &runtime, &vendor}
		for _, path := range paths {
			if *path == "" {
				return fail("invalid_request")
			}
			absolute, err := filepath.Abs(*path)
			if err != nil {
				return fail("invalid_request")
			}
			*path = absolute
		}
		temp, err := os.MkdirTemp(filepath.Dir(input), "modeltrace-analyze-")
		if err != nil {
			return fail("configuration_invalid")
		}
		defer os.RemoveAll(temp)
		if config.ModelTracePrivateDirectory(temp) != nil {
			return fail("configuration_invalid")
		}
		process, err := config.ModelTraceProcess(python, filepath.Join(filepath.Dir(runtime), "worker.py"),
			runtime, vendor, bank, temp, pins)
		if err != nil {
			return fail("configuration_invalid")
		}
		engine, err := modeltrace.NewProcessEngine(process)
		if err != nil {
			return fail("configuration_invalid")
		}
		result, err := engine.Analyze(ctx, evidence)
		if err != nil || result.Validate() != nil {
			return fail("execution_failed")
		}
		projection, err = json.Marshal(result)
		if err != nil || len(projection) > modeltraceapi.MaxBodyBytes {
			return fail("invalid_result")
		}
	} else {
		base, err := url.Parse(address)
		if err != nil || base.Scheme != "http" || base.User != nil || base.Path != "" ||
			base.RawQuery != "" || base.Fragment != "" || base.Opaque != "" || base.ForceQuery {
			return fail("invalid_request")
		}
		host, port, err := net.SplitHostPort(base.Host)
		ip := net.ParseIP(host)
		number, portErr := strconv.Atoi(port)
		if err != nil || ip == nil || !ip.IsLoopback() || portErr != nil || number < 1 || number > 65535 {
			return fail("invalid_request")
		}
		if lookup == nil {
			return fail("configuration_invalid")
		}
		key := []byte(lookup("SMART_ROUTER_MODELTRACE_INGEST_KEY"))
		if len(key) < 32 || len(key) > 4096 {
			return fail("configuration_invalid")
		}
		method := http.MethodGet
		base.Path = "/v1/modeltrace/probes/" + id
		if args[0] == "submit" {
			method, base.Path = http.MethodPost, "/v1/modeltrace/probes"
		}
		request, err := http.NewRequestWithContext(ctx, method, base.String(), bytes.NewReader(body))
		if err != nil || modeltraceapi.Sign(request, body, key, time.Now(), "") != nil {
			return fail("invalid_request")
		}
		request.Header.Set("Content-Type", "application/json")
		transport := &http.Transport{Proxy: nil, DisableKeepAlives: true,
			DialContext: (&net.Dialer{Timeout: 3 * time.Second}).DialContext,
			ResponseHeaderTimeout: 20 * time.Second}
		defer transport.CloseIdleConnections()
		client := &http.Client{Transport: transport, Timeout: 25 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
		response, err := client.Do(request)
		if err != nil {
			return fail("transport_failed")
		}
		defer response.Body.Close()
		data, err := io.ReadAll(io.LimitReader(response.Body, modeltraceapi.MaxBodyBytes+1))
		if err != nil || response.StatusCode != http.StatusOK || len(data) > modeltraceapi.MaxBodyBytes {
			return fail("transport_failed")
		}
		record, err := modeltraceapi.DecodeRecord(data)
		if err != nil || (args[0] == "get" && record.ProbeID != id) ||
			(args[0] == "submit" && (record.ProbeID != evidence.ProbeID || record.BindingID != evidence.BindingID ||
				record.ClaimedModel != evidence.ClaimedModel || record.Protocol != evidence.Protocol)) {
			return fail("invalid_record")
		}
		if args[0] == "submit" {
			digest, err := evidence.Digest()
			if err != nil || digest != record.EvidenceSHA256 {
				return fail("invalid_record")
			}
		}
		projection, err = json.Marshal(record)
		if err != nil {
			return fail("invalid_record")
		}
	}
	projection = append(projection, '\n')
	if n, err := stdout.Write(projection); err != nil || n != len(projection) {
		return fail("output_failed")
	}
	return 0
}

func main() {
	os.Exit(run(context.Background(), os.Args[1:], os.Getenv, config.ModelTracePins{
		PythonSHA256: releasePythonSHA256, RuntimeManifestSHA256: releaseRuntimeSHA256,
		VendorManifestSHA256: releaseVendorSHA256,
	}, os.Stdout, os.Stderr))
}
