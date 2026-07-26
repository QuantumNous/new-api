package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPlaygroundCanvasTestDB(t *testing.T) {
	t.Helper()
	old := DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&PlaygroundCanvasProject{}, &PlaygroundCanvasVersion{}))
	DB = db
	t.Cleanup(func() { DB = old })
}

func TestPlaygroundCanvasUpdateCAS(t *testing.T) {
	setupPlaygroundCanvasTestDB(t)

	p := &PlaygroundCanvasProject{
		UserId: 7,
		Title:  "Board",
		Doc:    `{"nodes":[]}`,
	}
	require.NoError(t, CreatePlaygroundCanvasProject(p))
	require.NotZero(t, p.Id)
	base := p.UpdatedAt

	newAt, err := UpdatePlaygroundCanvasProject(p.Id, 7, base, map[string]any{
		"doc": `{"nodes":[1]}`,
	})
	require.NoError(t, err)
	assert.NotEqual(t, base, newAt)

	got, err := GetPlaygroundCanvasProject(p.Id, 7)
	require.NoError(t, err)
	assert.Equal(t, `{"nodes":[1]}`, got.Doc)
	assert.Equal(t, newAt, got.UpdatedAt)

	// Stale base must not modify doc.
	_, err = UpdatePlaygroundCanvasProject(p.Id, 7, base, map[string]any{
		"doc": `{"nodes":["stale"]}`,
	})
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	got, err = GetPlaygroundCanvasProject(p.Id, 7)
	require.NoError(t, err)
	assert.Equal(t, `{"nodes":[1]}`, got.Doc)
	assert.Equal(t, newAt, got.UpdatedAt)

	// Consecutive same-second saves still advance the CAS token.
	nextAt, err := UpdatePlaygroundCanvasProject(p.Id, 7, newAt, map[string]any{
		"doc": `{"nodes":[2]}`,
	})
	require.NoError(t, err)
	assert.NotEqual(t, newAt, nextAt)

	got, err = GetPlaygroundCanvasProject(p.Id, 7)
	require.NoError(t, err)
	assert.Equal(t, `{"nodes":[2]}`, got.Doc)
	assert.Equal(t, nextAt, got.UpdatedAt)
}

func TestPlaygroundCanvasVersionSnapshot(t *testing.T) {
	setupPlaygroundCanvasTestDB(t)

	p := &PlaygroundCanvasProject{UserId: 11, Title: "Board", Doc: `{"nodes":[1]}`}
	require.NoError(t, CreatePlaygroundCanvasProject(p))

	require.NoError(t, SnapshotPlaygroundCanvasProject(p))
	versions, err := ListPlaygroundCanvasVersions(p.Id, 11)
	require.NoError(t, err)
	require.Len(t, versions, 1)

	// A second snapshot inside the interval reuses the existing one.
	p.Doc = `{"nodes":[2]}`
	require.NoError(t, SnapshotPlaygroundCanvasProject(p))
	versions, err = ListPlaygroundCanvasVersions(p.Id, 11)
	require.NoError(t, err)
	require.Len(t, versions, 1)
	assert.Empty(t, versions[0].Doc, "list must not carry document payloads")

	full, err := GetPlaygroundCanvasVersion(versions[0].Id, p.Id, 11)
	require.NoError(t, err)
	assert.Equal(t, `{"nodes":[1]}`, full.Doc)

	// Snapshots belong to their owner only.
	_, err = GetPlaygroundCanvasVersion(versions[0].Id, p.Id, 12)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	other, err := ListPlaygroundCanvasVersions(p.Id, 12)
	require.NoError(t, err)
	assert.Empty(t, other)
}

func TestPlaygroundCanvasVersionPruning(t *testing.T) {
	setupPlaygroundCanvasTestDB(t)

	p := &PlaygroundCanvasProject{UserId: 21, Title: "Board", Doc: `{"nodes":[]}`}
	require.NoError(t, CreatePlaygroundCanvasProject(p))

	base := time.Now().Unix() - int64(PlaygroundCanvasVersionLimit+5)*PlaygroundCanvasVersionInterval
	for i := 0; i < PlaygroundCanvasVersionLimit+5; i++ {
		require.NoError(t, DB.Create(&PlaygroundCanvasVersion{
			ProjectId: p.Id,
			UserId:    p.UserId,
			Title:     p.Title,
			Doc:       `{"nodes":["old"]}`,
			CreatedAt: base + int64(i),
		}).Error)
	}
	require.NoError(t, SnapshotPlaygroundCanvasProject(p))

	var total int64
	require.NoError(t, DB.Model(&PlaygroundCanvasVersion{}).
		Where("project_id = ?", p.Id).Count(&total).Error)
	assert.EqualValues(t, PlaygroundCanvasVersionLimit, total)

	versions, err := ListPlaygroundCanvasVersions(p.Id, 21)
	require.NoError(t, err)
	require.NotEmpty(t, versions)
	newest, err := GetPlaygroundCanvasVersion(versions[0].Id, p.Id, 21)
	require.NoError(t, err)
	assert.Equal(t, `{"nodes":[]}`, newest.Doc)
}

func TestPlaygroundCanvasDeleteRemovesVersions(t *testing.T) {
	setupPlaygroundCanvasTestDB(t)

	p := &PlaygroundCanvasProject{UserId: 31, Title: "Board", Doc: `{"nodes":[1]}`}
	require.NoError(t, CreatePlaygroundCanvasProject(p))
	require.NoError(t, SnapshotPlaygroundCanvasProject(p))
	require.NoError(t, DeletePlaygroundCanvasProject(p.Id, 31))

	versions, err := ListPlaygroundCanvasVersions(p.Id, 31)
	require.NoError(t, err)
	assert.Empty(t, versions)
}
