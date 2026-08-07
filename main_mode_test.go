package main

import (
	"errors"
	"testing"
)

func TestMigrateOnlyStartupDispatchesOnlyMigration(t *testing.T) {
	mode, err := parseStartupMode("migrate-only")
	if err != nil {
		t.Fatalf("parse migrate-only mode: %v", err)
	}

	migrationCalls := 0
	serverCalls := 0
	err = runStartupMode(
		mode,
		func() error { migrationCalls++; return nil },
		func() error { serverCalls++; return nil },
	)
	if err != nil {
		t.Fatalf("run migrate-only mode: %v", err)
	}
	if migrationCalls != 1 {
		t.Fatalf("expected exactly one migration call, got %d", migrationCalls)
	}
	if serverCalls != 0 {
		t.Fatalf("migrate-only mode must not start the HTTP server or background tasks, got %d server calls", serverCalls)
	}
}

func TestNormalStartupDispatchesOnlyServer(t *testing.T) {
	mode, err := parseStartupMode("")
	if err != nil {
		t.Fatalf("parse normal mode: %v", err)
	}

	migrationCalls := 0
	serverCalls := 0
	err = runStartupMode(
		mode,
		func() error { migrationCalls++; return nil },
		func() error { serverCalls++; return nil },
	)
	if err != nil {
		t.Fatalf("run normal mode: %v", err)
	}
	if migrationCalls != 0 || serverCalls != 1 {
		t.Fatalf("normal mode dispatched migration=%d server=%d, want 0 and 1", migrationCalls, serverCalls)
	}
}

func TestStartupModeRejectsUnknownValues(t *testing.T) {
	_, err := parseStartupMode("probe-production")
	if err == nil {
		t.Fatal("expected unknown startup mode to be rejected")
	}
}

func TestStartupModePropagatesMigrationFailure(t *testing.T) {
	mode, err := parseStartupMode("migrate-only")
	if err != nil {
		t.Fatalf("parse migrate-only mode: %v", err)
	}
	want := errors.New("migration failed")
	err = runStartupMode(mode, func() error { return want }, func() error { return nil })
	if !errors.Is(err, want) {
		t.Fatalf("got %v, want migration failure", err)
	}
}
