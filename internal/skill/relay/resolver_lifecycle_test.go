package skillrelay

import (
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ---- query counter (black-box DB-layer assertion) ----
//
// attachQueryCounter registers a GORM query callback that counts SELECTs touching
// user_enabled_skills and skill_versions. This lets tests prove, without any
// production test hook, that (a) lifecycle-only rejections short-circuit before the
// enabled lookup, and (b) a gate failure never loads prompt-bearing SkillVersion data.
type queryCounter struct {
	mu     sync.Mutex
	counts map[string]int
}

func (q *queryCounter) get(table string) int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.counts[table]
}

func attachQueryCounter(t *testing.T, database *gorm.DB) *queryCounter {
	t.Helper()
	qc := &queryCounter{counts: map[string]int{}}
	err := database.Callback().Query().After("gorm:query").Register("dr66_query_counter", func(d *gorm.DB) {
		sql := strings.ToLower(d.Statement.SQL.String())
		qc.mu.Lock()
		defer qc.mu.Unlock()
		if strings.Contains(sql, "user_enabled_skills") {
			qc.counts["user_enabled_skills"]++
		}
		if strings.Contains(sql, "skill_versions") {
			qc.counts["skill_versions"]++
		}
		if strings.Contains(sql, "skill_versions") && strings.Contains(sql, "instruction_template") {
			qc.counts["skill_versions_prompt"]++
		}
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = database.Callback().Query().Remove("dr66_query_counter") })
	return qc
}

// newTestDBNoEnabledTable migrates everything EXCEPT user_enabled_skills, so a
// published skill loads fine but the gate's enabled lookup hits a missing table and
// returns a real DB error (mapped to SKILL_INTERNAL_ERROR).
func newTestDBNoEnabledTable(t *testing.T) *gorm.DB {
	t.Helper()
	database := newTestDB(t)
	require.NoError(t, database.Migrator().DropTable(&skillmodel.UserEnabledSkill{}))
	return database
}

func deprecatedSkill() *skillmodel.Skill {
	s := defaultSkill()
	s.Status = enums.SkillStatusDeprecated
	return s
}

// ---- published + enabled-state integration (DR-66 D1) ----

func TestResolve_DR66_PublishedEnabled_Succeeds(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(200))

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 200, skill.ID)

	ctx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, ctx)
}

func TestResolve_DR66_PublishedNoEnabledRow_ReturnsNotEnabled(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(201))

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	// no enabled row seeded

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotEnabled, code,
		"published skill with no user_enabled_skills row must be SKILL_NOT_ENABLED")
}

func TestResolve_DR66_PublishedEnabledFalse_ReturnsNotEnabled(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(202))

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	disableSkillRow(t, database, 202, skill.ID) // enabled=false (avoids GORM default:true trap)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotEnabled, code,
		"published skill with enabled=false must be SKILL_NOT_ENABLED")
}

// ---- deprecated: DR-67 opens existing-enabled users, then entitlement still applies ----

func TestResolve_DR67_DeprecatedEnabled_SucceedsWhenStillEntitled(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(203))

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, deprecatedSkill())
	require.NoError(t, database.Create(&skillmodel.UserEnabledSkill{
		UserID: 203, TenantID: 203, SkillID: skill.ID, Enabled: true,
	}).Error)

	ctx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, ctx)
}

func TestResolve_DR66_DeprecatedNoRow_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(204))

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, deprecatedSkill())

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}

// ---- DB error mapping ----

func TestResolve_DR66_EnabledLookupDBError_ReturnsInternalError(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(205))

	database := newTestDBNoEnabledTable(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillInternalError, code,
		"a real DB error on the enabled lookup must map to SKILL_INTERNAL_ERROR, not NOT_ENABLED")
}

// ---- tenant/user isolation (tenant_id = user_id, V1) ----

func TestResolve_DR66_OtherUsersEnabledRow_DoesNotLeak(t *testing.T) {
	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	// user 301 is enabled; user 302 is NOT.
	enableSkillRow(t, database, 301, skill.ID)

	c := newTestContext(t)
	setContextUser(c, enabledUser(302))

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotEnabled, code,
		"another user's enabled row must not satisfy the gate for the current user")
}

// ---- short-circuit: lifecycle-only rejections must NOT query user_enabled_skills ----

func TestResolve_DR66_DraftSkill_DoesNotQueryEnabled(t *testing.T) {
	database := newTestDB(t)
	qc := attachQueryCounter(t, database)

	s := defaultSkill()
	s.Status = enums.SkillStatusDraft
	skill := insertSkill(t, database, s)

	c := newTestContext(t)
	setContextUser(c, enabledUser(310))

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
	assert.Equal(t, 0, qc.get("user_enabled_skills"),
		"draft skill must be rejected on lifecycle alone, with zero enabled lookups")
}

func TestResolve_DR66_ArchivedSkill_DoesNotQueryEnabled(t *testing.T) {
	database := newTestDB(t)
	qc := attachQueryCounter(t, database)

	s := defaultSkill()
	s.Status = enums.SkillStatusArchived
	skill := insertSkill(t, database, s)

	c := newTestContext(t)
	setContextUser(c, enabledUser(311))

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
	assert.Equal(t, 0, qc.get("user_enabled_skills"),
		"archived skill must be rejected on lifecycle alone, with zero enabled lookups")
}

func TestResolve_DR67_DeprecatedNoRow_QueriesEnabledButDoesNotLoadSnapshot(t *testing.T) {
	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, deprecatedSkill())

	qc := attachQueryCounter(t, database)
	c := newTestContext(t)
	setContextUser(c, enabledUser(312))

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
	assert.Equal(t, 1, qc.get("user_enabled_skills"),
		"deprecated+flag-on must check current enablement")
	assert.Equal(t, 0, qc.get("skill_versions"),
		"deprecated without enablement must not load any SkillVersion data")
}

// ---- missing active version: lifecycle wins over the enabled lookup ----

// TestResolve_DR66_PublishedNilActiveVersion_NoEnabledQuery proves a published skill
// with a NULL active_version_id is rejected with SKILL_NOT_PUBLISHED on lifecycle alone,
// without ever querying user_enabled_skills (the lookup is gated on hasActiveVersion).
func TestResolve_DR66_PublishedNilActiveVersion_NoEnabledQuery(t *testing.T) {
	database := newTestDB(t)
	qc := attachQueryCounter(t, database)

	s := defaultSkill() // published
	s.ActiveVersionID = nil
	skill := insertSkill(t, database, s)

	c := newTestContext(t)
	setContextUser(c, enabledUser(330))

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code,
		"published + nil active version must be NOT_PUBLISHED")
	assert.Equal(t, 0, qc.get("user_enabled_skills"),
		"missing active version must short-circuit before the enabled lookup")
}

// TestResolve_DR66_PublishedNilActiveVersion_EnabledErrorDoesNotMask is the priority
// guard: even if the enabled lookup WOULD fail (table missing), a published skill with a
// nil active version must still return SKILL_NOT_PUBLISHED — the higher-priority lifecycle
// failure must not be masked by SKILL_INTERNAL_ERROR. With the short-circuit, the lookup
// is skipped entirely, so no DB error can occur.
func TestResolve_DR66_PublishedNilActiveVersion_EnabledErrorDoesNotMask(t *testing.T) {
	database := newTestDBNoEnabledTable(t) // user_enabled_skills dropped -> lookup would error

	s := defaultSkill() // published
	s.ActiveVersionID = nil
	skill := insertSkill(t, database, s)

	c := newTestContext(t)
	setContextUser(c, enabledUser(331))

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code,
		"lifecycle NOT_PUBLISHED must take priority and never be masked by a (skipped) enabled-lookup DB error")
}

// ---- no-snapshot: gate failure must never load the SkillVersion snapshot ----

// TestResolve_DR66_GateFail_NeverLoadsSnapshot is the priority-0 "No prompt load"
// assertion (tasks/05 error table; threat T-05): a published-but-not-enabled request
// is rejected with zero SELECTs against skill_versions, so no snapshot/prompt is bound.
func TestResolve_DR66_GateFail_NeverLoadsSnapshot(t *testing.T) {
	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	// no enabled row -> gate fails at SKILL_NOT_ENABLED

	qc := attachQueryCounter(t, database)
	c := newTestContext(t)
	setContextUser(c, enabledUser(320))

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotEnabled, code)
	assert.Equal(t, 0, qc.get("skill_versions"),
		"gate failure must return before any skill_versions snapshot SELECT (no prompt load)")
}

// TestResolve_DR67_Success_LoadsVersionMetadataThenPromptSnapshot is the positive
// control: a passing gate reads entitlement metadata first, then prompt-bearing
// snapshot after entitlement succeeds.
func TestResolve_DR67_Success_LoadsVersionMetadataThenPromptSnapshot(t *testing.T) {
	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 321, skill.ID)

	qc := attachQueryCounter(t, database)
	c := newTestContext(t)
	setContextUser(c, enabledUser(321))

	ctx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, ctx)
	assert.Equal(t, 1, qc.get("user_enabled_skills"), "success must query enabled exactly once")
	assert.Equal(t, 2, qc.get("skill_versions"), "success must load version metadata and then the prompt snapshot")
	assert.Equal(t, 1, qc.get("skill_versions_prompt"), "success must load prompt-bearing snapshot exactly once")
}
