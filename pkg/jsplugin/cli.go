package jsplugin

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
)

// RunCLI implements the `new-api plugin` subcommand: linting a plugin source
// and replaying a golden fixture against it. It returns a process exit code.
func RunCLI(args []string, stdout, stderr io.Writer) int {
	if len(args) < 2 {
		fmt.Fprintln(stderr, "usage: new-api plugin lint <plugin.js> | new-api plugin test <plugin.js> --fixture <fixture.json>")
		return 2
	}
	command, sourcePath := args[0], args[1]
	source, err := os.ReadFile(sourcePath)
	if err != nil {
		fmt.Fprintf(stderr, "read plugin: %v\n", err)
		return 1
	}

	switch command {
	case "lint":
		if len(args) != 2 {
			fmt.Fprintln(stderr, "usage: new-api plugin lint <plugin.js>")
			return 2
		}
		plugin, compileErr := NewRegistry().Register(string(source), Options{Key: sourcePath, Version: "lint"})
		if compileErr != nil {
			fmt.Fprintf(stderr, "plugin lint failed: %v\n", compileErr)
			return 1
		}
		fmt.Fprintf(stdout, "plugin %s@%s is valid\n", plugin.Meta.Key, plugin.Meta.Version)
		return 0
	case "test":
		if len(args) != 4 || args[2] != "--fixture" || strings.TrimSpace(args[3]) == "" {
			fmt.Fprintln(stderr, "usage: new-api plugin test <plugin.js> --fixture <fixture.json>")
			return 2
		}
		fixture, readErr := os.ReadFile(args[3])
		if readErr != nil {
			fmt.Fprintf(stderr, "read fixture: %v\n", readErr)
			return 1
		}
		report, replayErr := ReplayFixture(context.Background(), string(source), fixture)
		if replayErr != nil {
			fmt.Fprintf(stderr, "plugin fixture failed after %d/%d cases: %v\n", report.Passed, report.Total, replayErr)
			return 1
		}
		fmt.Fprintf(stdout, "plugin fixture passed: %d/%d cases\n", report.Passed, report.Total)
		return 0
	default:
		fmt.Fprintf(stderr, "unknown plugin command %q\n", command)
		return 2
	}
}
