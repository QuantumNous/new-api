package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type commandOptions struct {
	file   string
	apply  bool
	dryRun bool
	dsn    string
}

type importRow struct {
	ModelName      string   `json:"model_name"`
	Author         string   `json:"author"`
	Providers      []string `json:"providers"`
	Modalities     []string `json:"modalities"`
	ContextTokens  *int64   `json:"context_tokens"`
	Series         string   `json:"series"`
	Categories     []string `json:"categories"`
	ReleasedAt     string   `json:"released_at"`
	Distillable    bool     `json:"distillable"`
	PopularityRank *int     `json:"popularity_rank,omitempty"`
	TopTenRank     *int     `json:"top_ten_rank,omitempty"`
	Status         *int     `json:"status,omitempty"`
}

func parseCommandOptions(args []string, getenv func(string) string) (commandOptions, error) {
	flags := flag.NewFlagSet("model_directory_metadata", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	var options commandOptions
	flags.StringVar(&options.file, "file", "", "reviewed metadata JSON file")
	flags.BoolVar(&options.dryRun, "dry-run", false, "validate and print the import plan without metadata writes")
	flags.BoolVar(&options.apply, "apply", false, "apply the reviewed import in one transaction")
	if err := flags.Parse(args); err != nil {
		return commandOptions{}, err
	}
	if flags.NArg() != 0 {
		return commandOptions{}, fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}
	options.file = strings.TrimSpace(options.file)
	if options.file == "" {
		return commandOptions{}, errors.New("--file is required")
	}
	if options.dryRun == options.apply {
		return commandOptions{}, errors.New("exactly one of --dry-run or --apply is required")
	}
	options.dsn = strings.TrimSpace(getenv("SQL_DSN"))
	if options.dsn == "" {
		return commandOptions{}, errors.New("SQL_DSN must be set explicitly")
	}
	return options, nil
}

func decodeImportFile(path string) ([]model.ModelDirectoryMetadata, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var document []importRow
	if err := common.Unmarshal(raw, &document); err != nil {
		return nil, fmt.Errorf("decode import document: %w", err)
	}
	rows := make([]model.ModelDirectoryMetadata, 0, len(document))
	for index, item := range document {
		providersJSON, err := common.Marshal(item.Providers)
		if err != nil {
			return nil, fmt.Errorf("row %d providers: %w", index+1, err)
		}
		modalitiesJSON, err := common.Marshal(item.Modalities)
		if err != nil {
			return nil, fmt.Errorf("row %d modalities: %w", index+1, err)
		}
		categoriesJSON, err := common.Marshal(item.Categories)
		if err != nil {
			return nil, fmt.Errorf("row %d categories: %w", index+1, err)
		}
		status := 1
		if item.Status != nil {
			status = *item.Status
		}
		rows = append(rows, model.ModelDirectoryMetadata{
			ModelName:      item.ModelName,
			Author:         item.Author,
			ProvidersJSON:  string(providersJSON),
			ModalitiesJSON: string(modalitiesJSON),
			ContextTokens:  item.ContextTokens,
			Series:         item.Series,
			CategoriesJSON: string(categoriesJSON),
			ReleasedAt:     item.ReleasedAt,
			Distillable:    item.Distillable,
			PopularityRank: item.PopularityRank,
			TopTenRank:     item.TopTenRank,
			Status:         status,
		})
	}
	return rows, nil
}

func run(args []string, getenv func(string) string, output io.Writer) error {
	options, err := parseCommandOptions(args, getenv)
	if err != nil {
		return err
	}

	rows, err := decodeImportFile(options.file)
	if err != nil {
		return err
	}

	// common.InitEnv parses the process-wide flag set used by the server. The
	// importer has already parsed its isolated flag set, so hide those arguments.
	originalArgs := os.Args
	os.Args = []string{originalArgs[0]}
	common.InitEnv()
	os.Args = originalArgs
	initDB := model.InitDB
	if options.dryRun {
		initDB = model.InitDBWithoutMigration
	}
	if err := initDB(); err != nil {
		return err
	}

	var result model.ModelDirectoryMetadataImportResult
	if options.apply {
		result, err = model.ApplyModelDirectoryMetadataImport(model.DB, rows)
	} else {
		result, err = model.PlanModelDirectoryMetadataImport(model.DB, rows)
	}
	if err != nil {
		return err
	}
	payload, err := common.Marshal(result)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(output, string(payload))
	return err
}

func main() {
	if err := run(os.Args[1:], os.Getenv, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
