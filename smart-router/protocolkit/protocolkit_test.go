package protocolkit

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"reflect"
	"testing"

	"smart-router/api"
)

func TestApprovedModelIDsAreLockedToThirtySix(t *testing.T) {
	want := []string{
		"claude-fable-5",
		"claude-haiku-4-5",
		"claude-opus-4-6",
		"claude-opus-4-7",
		"claude-opus-4-8",
		"claude-opus-5",
		"claude-sonnet-4-6",
		"claude-sonnet-5",
		"deepseek-v4-pro",
		"deepseekv4.1flash",
		"doubao-1-5-lite-32k",
		"doubao-1-5-pro-32k",
		"doubao-1-5-pro-32k-character",
		"doubao-seed-1.6",
		"doubao-seed-1.6-flash",
		"doubao-seed-1.8",
		"doubao-seed-2.0-code",
		"doubao-seed-2.0-lite",
		"doubao-seed-2.0-mini",
		"doubao-seed-2.0-pro",
		"doubao-seed-2.1-pro",
		"doubao-seed-2.1-turbo",
		"glm-4.7",
		"glm-5.1",
		"glm-5.2",
		"glm-5.3",
		"glm-5.3-flash",
		"gpt-5.3-codex-spark",
		"gpt-5.5",
		"gpt-5.6",
		"gpt-6-astra",
		"grok-4.5",
		"grok-4.6",
		"kimi-k2-5",
		"kimi-k3",
		"minimax-m3",
	}
	if got := ApprovedModelIDs(); !reflect.DeepEqual(got, want) {
		t.Fatalf("ApprovedModelIDs() = %#v, want locked 36-ID allowlist", got)
	}

	got := ApprovedModelIDs()
	got[0] = "mutated-by-caller"
	if ApprovedModelIDs()[0] != want[0] {
		t.Fatal("ApprovedModelIDs() exposed mutable package state")
	}
}

func TestConformanceMatrixIsExactlyThirtySixModelsByThreeProtocols(t *testing.T) {
	wantProtocols := []api.Protocol{
		api.ProtocolChat,
		api.ProtocolResponses,
		api.ProtocolMessages,
	}
	if got := Protocols(); !reflect.DeepEqual(got, wantProtocols) {
		t.Fatalf("Protocols() = %#v, want %#v", got, wantProtocols)
	}

	cells, err := Run()
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if len(cells) != 108 {
		t.Fatalf("Run() cell count = %d, want 36 x 3 = 108", len(cells))
	}

	identities := make(map[string]bool, len(cells))
	perModel := make(map[string]map[api.Protocol]bool, 36)
	for _, cell := range cells {
		identity := cell.ModelID + "\x00" + string(cell.Protocol)
		if identities[identity] {
			t.Fatalf("duplicate cell identity %q/%q", cell.ModelID, cell.Protocol)
		}
		identities[identity] = true
		if perModel[cell.ModelID] == nil {
			perModel[cell.ModelID] = make(map[api.Protocol]bool, 3)
		}
		perModel[cell.ModelID][cell.Protocol] = true

		if cell.Provider != "ebond" &&
			cell.Provider != "hualong" &&
			cell.Provider != "leyi" {
			t.Fatalf("cell provider = %q, want deterministic approved provider", cell.Provider)
		}
		if cell.AdapterPath == "" {
			t.Fatalf("cell %q/%q did not record a real adapter path", cell.ModelID, cell.Protocol)
		}
		assertChecks(t, cell, true)
	}
	if len(perModel) != 36 {
		t.Fatalf("matrix model count = %d, want 36", len(perModel))
	}
	for modelID, protocols := range perModel {
		if len(protocols) != 3 {
			t.Fatalf("model %q protocol count = %d, want 3", modelID, len(protocols))
		}
		for _, protocol := range wantProtocols {
			if !protocols[protocol] {
				t.Fatalf("model %q missing protocol %q", modelID, protocol)
			}
		}
	}
}

func TestConformanceMatrixIsStableAcrossThreeRuns(t *testing.T) {
	var baseline [32]byte
	for run := 1; run <= 3; run++ {
		cells, err := Run()
		if err != nil {
			t.Fatalf("run %d error = %v", run, err)
		}
		payload, err := json.Marshal(cells)
		if err != nil {
			t.Fatalf("marshal run %d: %v", run, err)
		}
		digest := sha256.Sum256(payload)
		if run == 1 {
			baseline = digest
		} else if digest != baseline {
			t.Fatalf("run %d digest differs from baseline", run)
		}
	}
}

func TestConformanceMutationCausesSelectedCellFailure(t *testing.T) {
	target := Mutation{
		ModelID:  ApprovedModelIDs()[0],
		Protocol: api.ProtocolResponses,
		Check:    CheckUsage,
	}
	cells, err := RunWithMutation(target)
	if err != nil {
		t.Fatalf("RunWithMutation() error = %v", err)
	}
	if len(cells) != 108 {
		t.Fatalf("mutated cell count = %d, want 108", len(cells))
	}

	failures := 0
	for _, cell := range cells {
		if cell.Passed {
			continue
		}
		failures++
		if cell.ModelID != target.ModelID || cell.Protocol != target.Protocol {
			t.Fatalf("unexpected failed cell = %#v", cell)
		}
		assertChecks(t, cell, false)
	}
	if failures != 1 {
		t.Fatalf("mutated failed cell count = %d, want exactly 1", failures)
	}
}

func TestConformanceMutationRejectsUnknownCellOrCheck(t *testing.T) {
	tests := []Mutation{
		{ModelID: "not-approved", Protocol: api.ProtocolChat, Check: CheckUsage},
		{ModelID: ApprovedModelIDs()[0], Protocol: api.ProtocolTaskBridge, Check: CheckUsage},
		{ModelID: ApprovedModelIDs()[0], Protocol: api.ProtocolChat, Check: "unknown"},
	}
	for _, mutation := range tests {
		t.Run(fmt.Sprintf("%s/%s/%s", mutation.ModelID, mutation.Protocol, mutation.Check), func(t *testing.T) {
			if _, err := RunWithMutation(mutation); err == nil {
				t.Fatal("RunWithMutation() error = nil, want unsupported mutation rejection")
			}
		})
	}
}

func assertChecks(t *testing.T, cell Cell, wantAllPassed bool) {
	t.Helper()
	wantNames := []CheckName{
		CheckUnary,
		CheckStream,
		CheckTool,
		CheckUsage,
		CheckError,
	}
	if len(cell.Checks) != len(wantNames) {
		t.Fatalf(
			"cell %q/%q check count = %d, want %d",
			cell.ModelID,
			cell.Protocol,
			len(cell.Checks),
			len(wantNames),
		)
	}
	failed := 0
	for index, check := range cell.Checks {
		if check.Name != wantNames[index] {
			t.Fatalf("check %d name = %q, want %q", index, check.Name, wantNames[index])
		}
		if !check.Applicable {
			t.Fatalf("check %q unexpectedly marked inapplicable", check.Name)
		}
		if !check.Passed {
			failed++
		}
	}
	if wantAllPassed && (failed != 0 || !cell.Passed) {
		t.Fatalf("normal cell failed: %#v", cell)
	}
	if !wantAllPassed && (failed != 1 || cell.Passed) {
		t.Fatalf("mutated cell failure shape = %#v, want exactly one failed check", cell)
	}
}
