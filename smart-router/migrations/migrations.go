package migrations

import (
	"embed"
	"fmt"
	"io/fs"
	"sort"
)

// Files contains all standalone router database migrations.
//
//go:embed sqlite/*.sql mysql/*.sql postgres/*.sql
var Files embed.FS

type Migration struct {
	Name string
	SQL  string
}

func ForDialect(dialect string) ([]string, error) {
	migrationFiles, err := NamedForDialect(dialect)
	if err != nil {
		return nil, err
	}
	statements := make([]string, len(migrationFiles))
	for index, migration := range migrationFiles {
		statements[index] = migration.SQL
	}
	return statements, nil
}

func NamedForDialect(dialect string) ([]Migration, error) {
	entries, err := fs.ReadDir(Files, dialect)
	if err != nil {
		return nil, fmt.Errorf("read %s migrations: %w", dialect, err)
	}
	sort.Slice(entries, func(left, right int) bool {
		return entries[left].Name() < entries[right].Name()
	})
	migrationFiles := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		content, err := Files.ReadFile(dialect + "/" + entry.Name())
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		migrationFiles = append(migrationFiles, Migration{
			Name: entry.Name(),
			SQL:  string(content),
		})
	}
	return migrationFiles, nil
}
