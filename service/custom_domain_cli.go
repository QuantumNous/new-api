package service

import (
	"flag"
	"fmt"
	"io"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func RunCustomDomainCLI(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		writeCustomDomainCLIUsage(stderr)
		return 2
	}

	switch args[0] {
	case "assign":
		return runCustomDomainAssign(args[1:], stdout, stderr)
	case "enable":
		return runCustomDomainToggle(args[1:], true, stdout, stderr)
	case "disable":
		return runCustomDomainToggle(args[1:], false, stdout, stderr)
	case "show":
		return runCustomDomainShow(args[1:], stdout, stderr)
	case "list":
		return runCustomDomainList(args[1:], stdout, stderr)
	default:
		writeCustomDomainCLIUsage(stderr)
		return 2
	}
}

func runCustomDomainAssign(args []string, stdout, stderr io.Writer) int {
	if len(args) < 1 {
		fmt.Fprintln(stderr, "usage: new-api domain assign <label> --owner-user-id <id>")
		return 2
	}
	flags := flag.NewFlagSet("domain assign", flag.ContinueOnError)
	flags.SetOutput(stderr)
	ownerUserID := flags.Int("owner-user-id", 0, "owner user ID")
	if err := flags.Parse(args[1:]); err != nil || flags.NArg() != 0 || *ownerUserID <= 0 {
		fmt.Fprintln(stderr, "usage: new-api domain assign <label> --owner-user-id <id>")
		return 2
	}
	label, err := model.NormalizeCustomDomainLabel(args[0], common.CustomDomainReservedLabels)
	if err != nil {
		fmt.Fprintln(stderr, "domain assign:", err)
		return 2
	}
	domain, err := model.CreateCustomDomain(label, *ownerUserID)
	if err != nil {
		fmt.Fprintln(stderr, "domain assign:", err)
		return 1
	}
	return writeCustomDomainCLIResult(stdout, stderr, domain)
}

func runCustomDomainToggle(args []string, enabled bool, stdout, stderr io.Writer) int {
	if len(args) != 1 {
		fmt.Fprintln(stderr, "usage: new-api domain enable|disable <label>")
		return 2
	}
	var reservedLabels map[string]struct{}
	if enabled {
		reservedLabels = common.CustomDomainReservedLabels
	}
	label, err := model.NormalizeCustomDomainLabel(args[0], reservedLabels)
	if err != nil {
		fmt.Fprintln(stderr, "domain update:", err)
		return 2
	}
	var domain *model.CustomDomain
	if enabled {
		domain, err = model.EnableCustomDomain(label)
	} else {
		domain, err = model.DisableCustomDomain(label)
	}
	if err != nil {
		fmt.Fprintln(stderr, "domain update:", err)
		return 1
	}
	return writeCustomDomainCLIResult(stdout, stderr, domain)
}

func runCustomDomainShow(args []string, stdout, stderr io.Writer) int {
	if len(args) != 1 {
		fmt.Fprintln(stderr, "usage: new-api domain show <label>")
		return 2
	}
	label, err := model.NormalizeCustomDomainLabel(args[0], nil)
	if err != nil {
		fmt.Fprintln(stderr, "domain show:", err)
		return 2
	}
	domain, err := model.GetCustomDomainByLabel(label)
	if err != nil {
		fmt.Fprintln(stderr, "domain show:", err)
		return 1
	}
	return writeCustomDomainCLIResult(stdout, stderr, domain)
}

func runCustomDomainList(args []string, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet("domain list", flag.ContinueOnError)
	flags.SetOutput(stderr)
	enabled := flags.Bool("enabled", false, "show enabled domains")
	disabled := flags.Bool("disabled", false, "show disabled domains")
	if err := flags.Parse(args); err != nil || flags.NArg() != 0 || (*enabled && *disabled) {
		fmt.Fprintln(stderr, "usage: new-api domain list [--enabled|--disabled]")
		return 2
	}
	var filter *bool
	if *enabled {
		value := true
		filter = &value
	}
	if *disabled {
		value := false
		filter = &value
	}
	domains, err := model.ListCustomDomains(filter)
	if err != nil {
		fmt.Fprintln(stderr, "domain list:", err)
		return 1
	}
	return writeCustomDomainCLIResult(stdout, stderr, domains)
}

func writeCustomDomainCLIResult(stdout, stderr io.Writer, value any) int {
	payload, err := common.Marshal(value)
	if err != nil {
		fmt.Fprintln(stderr, "failed to encode domain result:", err)
		return 1
	}
	if _, err := fmt.Fprintln(stdout, string(payload)); err != nil {
		fmt.Fprintln(stderr, "failed to write domain result:", err)
		return 1
	}
	return 0
}

func writeCustomDomainCLIUsage(stderr io.Writer) {
	fmt.Fprintln(stderr, "usage: new-api domain assign <label> --owner-user-id <id>")
	fmt.Fprintln(stderr, "       new-api domain enable|disable|show <label>")
	fmt.Fprintln(stderr, "       new-api domain list [--enabled|--disabled]")
}
