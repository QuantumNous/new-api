package main

import (
	"flag"
	"fmt"
	"os"
	"time"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 || args[0] == "--help" || args[0] == "-h" {
		fmt.Println("usage: cxm_migration <export|validate|import|report|in-place|rollback-project|restore-current> [flags]")
		return nil
	}
	switch args[0] {
	case "export":
		fs := flag.NewFlagSet("export", flag.ContinueOnError)
		sourceDSN := fs.String("source-dsn", "", "read-only source PostgreSQL DSN")
		bundlePath := fs.String("bundle", "", "new bundle path")
		agentID := fs.Int("agent-id", 315, "source agent user ID")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		bundle, err := exportSourceBundle(*sourceDSN, *agentID)
		if err != nil {
			return err
		}
		bundle, err = writeBundle(*bundlePath, bundle)
		if err != nil {
			return err
		}
		fmt.Printf("exported agent=%d customers=%d logs=%d redemptions=%d bundle_sha256=%s\n", bundle.AgentID, len(bundle.Customers), len(bundle.Logs), len(bundle.Redemptions), bundle.Manifest.SHA256)
		return nil
	case "validate":
		fs := flag.NewFlagSet("validate", flag.ContinueOnError)
		bundlePath := fs.String("bundle", "", "bundle path")
		targetDSN := fs.String("target-dsn", "", "optional target PostgreSQL DSN")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		bundle, err := readBundle(*bundlePath)
		if err != nil {
			return err
		}
		transformed, err := transformBundle(bundle)
		if err != nil {
			return err
		}
		if *targetDSN != "" {
			if err := validateTarget(*targetDSN, transformed); err != nil {
				return err
			}
		}
		printAudit(transformed)
		return nil
	case "import":
		fs := flag.NewFlagSet("import", flag.ContinueOnError)
		bundlePath := fs.String("bundle", "", "bundle path")
		targetDSN := fs.String("target-dsn", "", "target PostgreSQL DSN")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		bundle, err := readBundle(*bundlePath)
		if err != nil {
			return err
		}
		transformed, err := transformBundle(bundle)
		if err != nil {
			return err
		}
		if err := importTarget(*targetDSN, transformed); err != nil {
			return err
		}
		printAudit(transformed)
		return nil
	case "report":
		fs := flag.NewFlagSet("report", flag.ContinueOnError)
		bundlePath := fs.String("bundle", "", "bundle path")
		targetDSN := fs.String("target-dsn", "", "target PostgreSQL DSN")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		bundle, err := readBundle(*bundlePath)
		if err != nil {
			return err
		}
		transformed, err := transformBundle(bundle)
		if err != nil {
			return err
		}
		if err := reportTarget(*targetDSN, transformed); err != nil {
			return err
		}
		printAudit(transformed)
		return nil
	case "in-place":
		fs := flag.NewFlagSet("in-place", flag.ContinueOnError)
		targetDSN := fs.String("target-dsn", "", "target PostgreSQL DSN containing preserved legacy tables")
		dryRun := fs.Bool("dry-run", false, "validate and report without writing")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		report, err := migrateLegacyInPlace(*targetDSN, *dryRun, time.Now())
		if err != nil {
			return err
		}
		return printLegacyMigrationReport(report, *dryRun)
	case "rollback-project":
		fs := flag.NewFlagSet("rollback-project", flag.ContinueOnError)
		targetDSN := fs.String("target-dsn", "", "target PostgreSQL DSN")
		cutoverAt := fs.Int64("cutover-at", 0, "Unix timestamp at which the current system started accepting writes")
		runID := fs.String("run-id", "", "rollback run identifier")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		report, err := projectLegacyRollback(*targetDSN, *cutoverAt, *runID)
		if err != nil {
			return err
		}
		fmt.Printf("rollback_project run_id=%s ledger_rows=%d subscription_rows=%d quota_grant_rows=%d redemption_rows=%d agent_rows=%d\n", report.RunID, report.LedgerRows, report.SubscriptionRows, report.QuotaGrantRows, report.RedemptionRows, report.AgentRows)
		return nil
	case "restore-current":
		fs := flag.NewFlagSet("restore-current", flag.ContinueOnError)
		targetDSN := fs.String("target-dsn", "", "target PostgreSQL DSN")
		runID := fs.String("run-id", "", "rollback run identifier")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		report, err := restoreCurrentSchema(*targetDSN, *runID)
		if err != nil {
			return err
		}
		fmt.Printf("restore_current run_id=%s restored=%t\n", report.RunID, report.Restored)
		return nil
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}
