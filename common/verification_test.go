package common

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
)

type failFirstEvalAfterProcessHook struct {
	failed atomic.Bool
}

func (hook *failFirstEvalAfterProcessHook) BeforeProcess(ctx context.Context, _ redis.Cmder) (context.Context, error) {
	return ctx, nil
}

func (hook *failFirstEvalAfterProcessHook) AfterProcess(_ context.Context, cmd redis.Cmder) error {
	if cmd.Name() == "eval" && hook.failed.CompareAndSwap(false, true) {
		return errors.New("ambiguous Redis result")
	}
	return nil
}

func (hook *failFirstEvalAfterProcessHook) BeforeProcessPipeline(ctx context.Context, _ []redis.Cmder) (context.Context, error) {
	return ctx, nil
}

func (hook *failFirstEvalAfterProcessHook) AfterProcessPipeline(context.Context, []redis.Cmder) error {
	return nil
}

func resetVerificationMap() {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap = make(map[string]verificationValue)
}

func resetRegistrationEmailVerificationStore() {
	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	registrationEmailVerificationMap = make(map[string]verificationValue)
}

func withRedisDisabled(t *testing.T) {
	t.Helper()
	prev := RedisEnabled
	RedisEnabled = false
	t.Cleanup(func() { RedisEnabled = prev })
}

func TestVerifyCodeWithKeyMemory(t *testing.T) {
	withRedisDisabled(t)
	resetVerificationMap()

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected correct code to verify")
	}
	if VerifyCodeWithKey("a@b.com", "000000", EmailVerificationPurpose) {
		t.Fatal("expected wrong code to fail")
	}
	if VerifyCodeWithKey("a@b.com", "123456", PasswordResetPurpose) {
		t.Fatal("expected different purpose to fail")
	}

	DeleteKey("a@b.com", EmailVerificationPurpose)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected deleted code to fail")
	}
}

func TestVerifyCodeWithKeyMemoryExpiry(t *testing.T) {
	withRedisDisabled(t)
	resetVerificationMap()

	prev := VerificationValidMinutes
	VerificationValidMinutes = 0
	t.Cleanup(func() { VerificationValidMinutes = prev })

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected expired code to fail")
	}
}

// Regression test: with Redis enabled, a code registered by one instance must
// verify on another instance whose in-memory map is empty.
func TestVerifyCodeWithKeyRedisCrossInstance(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	// simulate the request landing on a different instance
	resetVerificationMap()

	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected code stored in Redis to verify on another instance")
	}
	if VerifyCodeWithKey("a@b.com", "000000", EmailVerificationPurpose) {
		t.Fatal("expected wrong code to fail")
	}
	if VerifyCodeWithKey("a@b.com", "123456", PasswordResetPurpose) {
		t.Fatal("expected different purpose to fail")
	}

	DeleteKey("a@b.com", EmailVerificationPurpose)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected deleted code to fail")
	}
}

func TestVerifyCodeWithKeyRedisExpiry(t *testing.T) {
	mr, cleanup := setupMiniredis(t)
	defer cleanup()

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	resetVerificationMap()

	// must verify via Redis first, so the expiry below exercises the real TTL
	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected code to verify before expiry")
	}

	mr.FastForward(time.Duration(VerificationValidMinutes)*time.Minute + time.Second)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected expired code to fail")
	}
}

// When Redis is enabled but unreachable, registration must fall back to the
// in-memory map so single-instance deployments keep working.
func TestVerifyCodeWithKeyRedisDownFallback(t *testing.T) {
	mr, cleanup := setupMiniredis(t)
	defer cleanup()
	resetVerificationMap()

	mr.Close() // Redis becomes unreachable

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected memory fallback to verify when Redis is down")
	}
}

// RedisEnabled defaults to true before InitRedisClient runs, leaving RDB nil;
// the verification functions must use the memory path instead of panicking.
func TestVerifyCodeWithKeyNilRDBFallsBackToMemory(t *testing.T) {
	prevEnabled, prevRDB := RedisEnabled, RDB
	RedisEnabled, RDB = true, nil
	t.Cleanup(func() { RedisEnabled, RDB = prevEnabled, prevRDB })
	resetVerificationMap()

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected memory path to work with nil RDB")
	}
	DeleteKey("a@b.com", EmailVerificationPurpose)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected deleted code to fail")
	}
}

func TestRegistrationEmailLinkMemoryReplacesPreviousToken(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	first, err := RegisterRegistrationEmailLink("  user@example.com  ")
	if err != nil {
		t.Fatalf("register first link: %v", err)
	}
	second, err := RegisterRegistrationEmailLink("user@example.com")
	if err != nil {
		t.Fatalf("register second link: %v", err)
	}
	if first == second {
		t.Fatal("expected independent random link tokens")
	}

	if _, ok, err := ResolveRegistrationEmailLink(first); err != nil || ok {
		t.Fatalf("old link should be invalid after resend, ok=%t err=%v", ok, err)
	}
	email, ok, err := ResolveRegistrationEmailLink(second)
	if err != nil {
		t.Fatalf("resolve current link: %v", err)
	}
	if !ok || email != "user@example.com" {
		t.Fatalf("resolve current link = (%q, %t), want trimmed email", email, ok)
	}

	decoded, err := base64.RawURLEncoding.DecodeString(second)
	if err != nil {
		t.Fatalf("token is not base64url: %v", err)
	}
	if len(decoded) != 32 {
		t.Fatalf("token entropy bytes = %d, want 32", len(decoded))
	}
}

func TestRegistrationEmailLinkMemoryReclaimsSupersededTokens(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()
	previousLimit := registrationEmailMemoryMaxSize
	registrationEmailMemoryMaxSize = 3
	t.Cleanup(func() { registrationEmailMemoryMaxSize = previousLimit })

	for attempt := 0; attempt < 8; attempt++ {
		if _, err := RegisterRegistrationEmailLink("user@example.com"); err != nil {
			t.Fatalf("register replacement link %d: %v", attempt+1, err)
		}
	}

	registrationEmailVerificationMutex.Lock()
	stored := len(registrationEmailVerificationMap)
	registrationEmailVerificationMutex.Unlock()
	if stored != 2 {
		t.Fatalf("stored credentials = %d, want only current link and pointer", stored)
	}
}

func TestRegistrationEmailLinkGrantMemoryIsIdempotent(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	token, err := RegisterRegistrationEmailLink("user@example.com")
	if err != nil {
		t.Fatalf("register link: %v", err)
	}

	const attempts = 32
	type exchangeResult struct {
		grant string
		ttl   time.Duration
		ok    bool
		err   error
	}
	results := make(chan exchangeResult, attempts)
	var wg sync.WaitGroup
	for range attempts {
		wg.Add(1)
		go func() {
			defer wg.Done()
			grant, ttl, ok, err := RegisterRegistrationEmailGrantForLink(token, "user@example.com")
			results <- exchangeResult{grant: grant, ttl: ttl, ok: ok, err: err}
		}()
	}
	wg.Wait()
	close(results)

	firstGrant := ""
	for result := range results {
		if result.err != nil {
			t.Fatalf("exchange link: %v", result.err)
		}
		if !result.ok || result.grant == "" {
			t.Fatal("exchange link was not accepted")
		}
		if result.ttl <= 0 || result.ttl > registrationEmailCredentialTTL() {
			t.Fatalf("exchange link ttl = %s", result.ttl)
		}
		if firstGrant == "" {
			firstGrant = result.grant
		} else if result.grant != firstGrant {
			t.Fatalf("grant = %q, want %q", result.grant, firstGrant)
		}
	}

	DeleteRegistrationEmailGrant(firstGrant)
	if _, _, ok, err := RegisterRegistrationEmailGrantForLink(token, "user@example.com"); err != nil || ok {
		t.Fatalf("consumed link must not mint a replacement grant, ok=%t err=%v", ok, err)
	}
}

func TestRegistrationEmailLinkGrantMemoryDoesNotExtendLinkLifetime(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	token, err := RegisterRegistrationEmailLink("user@example.com")
	if err != nil {
		t.Fatalf("register link: %v", err)
	}
	issuedAt := time.Now().Add(-registrationEmailCredentialTTL() / 2)
	registrationEmailVerificationMutex.Lock()
	linkKey := registrationEmailLinkPrefix + token
	currentKey := registrationEmailCurrentPrefix + registrationEmailDigest("user@example.com")
	linkValue := registrationEmailVerificationMap[linkKey]
	linkValue.time = issuedAt
	registrationEmailVerificationMap[linkKey] = linkValue
	currentValue := registrationEmailVerificationMap[currentKey]
	currentValue.time = issuedAt
	registrationEmailVerificationMap[currentKey] = currentValue
	registrationEmailVerificationMutex.Unlock()

	grant, ttl, ok, err := RegisterRegistrationEmailGrantForLink(token, "user@example.com")
	if err != nil || !ok {
		t.Fatalf("exchange aged link, ok=%t err=%v", ok, err)
	}
	if ttl > registrationEmailCredentialTTL()/2+time.Second {
		t.Fatalf("grant ttl = %s, want no longer than remaining link lifetime", ttl)
	}
	registrationEmailVerificationMutex.Lock()
	grantValue := registrationEmailVerificationMap[registrationEmailGrantPrefix+grant]
	registrationEmailVerificationMutex.Unlock()
	if !grantValue.time.Equal(issuedAt) {
		t.Fatalf("grant issued at %s, want link issue time %s", grantValue.time, issuedAt)
	}
}

func TestRegistrationEmailRedisContextHasDeadline(t *testing.T) {
	ctx, cancel := registrationEmailRedisContext()
	defer cancel()
	deadline, ok := ctx.Deadline()
	if !ok {
		t.Fatal("registration email Redis context must have a deadline")
	}
	remaining := time.Until(deadline)
	if remaining <= 0 || remaining > registrationEmailRedisTimeout {
		t.Fatalf("registration email Redis deadline remaining = %s", remaining)
	}
}

func TestRegistrationEmailGrantMemoryMatchesExactEmail(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	grant, err := RegisterRegistrationEmailGrant("  user@example.com  ")
	if err != nil {
		t.Fatalf("register grant: %v", err)
	}
	if !VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("expected matching trimmed email to verify")
	}
	if VerifyRegistrationEmailGrant(grant, "other@example.com") {
		t.Fatal("grant must not verify a different email")
	}

	DeleteRegistrationEmailGrant(grant)
	if VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("deleted grant must not verify")
	}
}

func TestConsumeRegistrationEmailGrantMemoryIsAtomic(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	grant, err := RegisterRegistrationEmailGrant("user@example.com")
	if err != nil {
		t.Fatalf("register grant: %v", err)
	}

	var successful int32
	var wg sync.WaitGroup
	for range 32 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if ConsumeRegistrationEmailGrant(grant, "user@example.com") {
				atomic.AddInt32(&successful, 1)
			}
		}()
	}
	wg.Wait()

	if successful != 1 {
		t.Fatalf("successful grant consumptions = %d, want 1", successful)
	}
	if VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("consumed grant must not remain valid")
	}
}

func TestRegistrationEmailGrantMemoryReservationRollsBack(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	grant, err := RegisterRegistrationEmailGrant("user@example.com")
	if err != nil {
		t.Fatalf("register grant: %v", err)
	}
	reservationOwner, ok := ReserveRegistrationEmailGrant(grant, "user@example.com")
	if !ok || reservationOwner == "" {
		t.Fatal("expected grant reservation to succeed")
	}
	if !reserveRegistrationEmailGrant(grant, "user@example.com", reservationOwner) {
		t.Fatal("expected the same reservation owner to retry idempotently")
	}
	if VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("reserved grant must not remain available")
	}
	if _, ok := ReserveRegistrationEmailGrant(grant, "user@example.com"); ok {
		t.Fatal("concurrent grant reservation must fail")
	}
	if RollbackRegistrationEmailGrantReservation(grant, "user@example.com", "different-owner") {
		t.Fatal("a different reservation owner must not roll back the grant")
	}
	if !RollbackRegistrationEmailGrantReservation(grant, "user@example.com", reservationOwner) {
		t.Fatal("expected grant reservation rollback to succeed")
	}
	if !VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("rolled back grant must be available for retry")
	}
}

func TestRegistrationEmailMemorySetBoundsCredentialCount(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	previousLimit := registrationEmailMemoryMaxSize
	registrationEmailMemoryMaxSize = 3
	t.Cleanup(func() { registrationEmailMemoryMaxSize = previousLimit })

	registrationEmailVerificationMutex.Lock()
	for index := range 4 {
		registrationEmailMemorySet(fmt.Sprintf("credential-%d", index), "user@example.com")
	}
	stored := len(registrationEmailVerificationMap)
	registrationEmailVerificationMutex.Unlock()

	if stored != registrationEmailMemoryMaxSize {
		t.Fatalf("stored credentials = %d, want %d", stored, registrationEmailMemoryMaxSize)
	}
}

func TestRegistrationEmailMemoryCapacityPreservesExistingGrant(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	previousLimit := registrationEmailMemoryMaxSize
	registrationEmailMemoryMaxSize = 1
	t.Cleanup(func() { registrationEmailMemoryMaxSize = previousLimit })

	grant, err := RegisterRegistrationEmailGrant("first@example.com")
	if err != nil {
		t.Fatalf("register first grant: %v", err)
	}
	if _, err := RegisterRegistrationEmailGrant("second@example.com"); err == nil {
		t.Fatal("expected a full memory store to reject a new grant")
	}
	if !VerifyRegistrationEmailGrant(grant, "first@example.com") {
		t.Fatal("expected the existing grant to remain valid after capacity rejection")
	}
}

func TestRegistrationEmailMemoryCapacityRejectsLinkAtomically(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	previousLimit := registrationEmailMemoryMaxSize
	registrationEmailMemoryMaxSize = 1
	t.Cleanup(func() { registrationEmailMemoryMaxSize = previousLimit })

	if _, err := RegisterRegistrationEmailLink("user@example.com"); err == nil {
		t.Fatal("expected a link requiring two entries to be rejected")
	}

	registrationEmailVerificationMutex.Lock()
	stored := len(registrationEmailVerificationMap)
	registrationEmailVerificationMutex.Unlock()
	if stored != 0 {
		t.Fatalf("stored credentials = %d, want no partial link state", stored)
	}
}

func TestRegistrationEmailMemorySetReclaimsExpiredCredentials(t *testing.T) {
	withRedisDisabled(t)
	resetRegistrationEmailVerificationStore()

	registrationEmailVerificationMutex.Lock()
	registrationEmailVerificationMap["expired-unused-link"] = verificationValue{
		code: "user@example.com",
		time: time.Now().Add(-registrationEmailCredentialTTL() - time.Second),
	}
	registrationEmailMemorySet("fresh-grant", "user@example.com")
	_, expiredStillStored := registrationEmailVerificationMap["expired-unused-link"]
	_, freshStored := registrationEmailVerificationMap["fresh-grant"]
	registrationEmailVerificationMutex.Unlock()

	if expiredStillStored {
		t.Fatal("expected an expired unreferenced credential to be reclaimed")
	}
	if !freshStored {
		t.Fatal("expected the newly inserted credential to remain stored")
	}
}

func TestRegistrationEmailLinkRedisCrossInstanceAndExpiry(t *testing.T) {
	mr, cleanup := setupMiniredis(t)
	defer cleanup()
	resetRegistrationEmailVerificationStore()

	token, err := RegisterRegistrationEmailLink("user@example.com")
	if err != nil {
		t.Fatalf("register link: %v", err)
	}
	resetRegistrationEmailVerificationStore()

	email, ok, err := ResolveRegistrationEmailLink(token)
	if err != nil {
		t.Fatalf("resolve Redis link: %v", err)
	}
	if !ok || email != "user@example.com" {
		t.Fatalf("resolve Redis link = (%q, %t), want stored email", email, ok)
	}

	mr.FastForward(time.Duration(VerificationValidMinutes)*time.Minute + time.Second)
	if _, ok, err := ResolveRegistrationEmailLink(token); err != nil || ok {
		t.Fatalf("expired Redis link should be invalid, ok=%t err=%v", ok, err)
	}
}

func TestRegistrationEmailLinkGrantRedisIsIdempotentAndDoesNotExtendLinkLifetime(t *testing.T) {
	mr, cleanup := setupMiniredis(t)
	defer cleanup()
	resetRegistrationEmailVerificationStore()

	token, err := RegisterRegistrationEmailLink("user@example.com")
	if err != nil {
		t.Fatalf("register link: %v", err)
	}
	mr.FastForward(registrationEmailCredentialTTL() / 2)

	firstGrant, firstTTL, ok, err := RegisterRegistrationEmailGrantForLink(token, "user@example.com")
	if err != nil || !ok {
		t.Fatalf("first Redis exchange, ok=%t err=%v", ok, err)
	}
	secondGrant, secondTTL, ok, err := RegisterRegistrationEmailGrantForLink(token, "user@example.com")
	if err != nil || !ok {
		t.Fatalf("second Redis exchange, ok=%t err=%v", ok, err)
	}
	if secondGrant != firstGrant {
		t.Fatalf("second grant = %q, want %q", secondGrant, firstGrant)
	}
	maxRemaining := registrationEmailCredentialTTL()/2 + time.Second
	if firstTTL > maxRemaining || secondTTL > maxRemaining {
		t.Fatalf("grant TTLs = (%s, %s), want no longer than remaining link lifetime", firstTTL, secondTTL)
	}
	if storedTTL := mr.TTL(registrationEmailGrantPrefix + firstGrant); storedTTL > maxRemaining {
		t.Fatalf("stored grant ttl = %s, want no longer than remaining link lifetime", storedTTL)
	}

	DeleteRegistrationEmailGrant(firstGrant)
	if _, _, ok, err := RegisterRegistrationEmailGrantForLink(token, "user@example.com"); err != nil || ok {
		t.Fatalf("consumed Redis link must not mint a replacement grant, ok=%t err=%v", ok, err)
	}
}

func TestRegistrationEmailGrantRedisCrossInstance(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()
	resetRegistrationEmailVerificationStore()

	grant, err := RegisterRegistrationEmailGrant("user@example.com")
	if err != nil {
		t.Fatalf("register grant: %v", err)
	}
	resetRegistrationEmailVerificationStore()

	if !VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("expected Redis grant to verify on another instance")
	}
	DeleteRegistrationEmailGrant(grant)
	if VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("deleted Redis grant must not verify")
	}
}

func TestConsumeRegistrationEmailGrantRedisIsAtomic(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()
	resetRegistrationEmailVerificationStore()

	grant, err := RegisterRegistrationEmailGrant("user@example.com")
	if err != nil {
		t.Fatalf("register grant: %v", err)
	}

	var successful int32
	var wg sync.WaitGroup
	for range 32 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if ConsumeRegistrationEmailGrant(grant, "user@example.com") {
				atomic.AddInt32(&successful, 1)
			}
		}()
	}
	wg.Wait()

	if successful != 1 {
		t.Fatalf("successful Redis grant consumptions = %d, want 1", successful)
	}
	if VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("consumed Redis grant must not remain valid")
	}
}

func TestRegistrationEmailGrantRedisReservationRollsBackAndCommits(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()
	resetRegistrationEmailVerificationStore()

	grant, err := RegisterRegistrationEmailGrant("user@example.com")
	if err != nil {
		t.Fatalf("register grant: %v", err)
	}
	reservationOwner, ok := ReserveRegistrationEmailGrant(grant, "user@example.com")
	if !ok || reservationOwner == "" {
		t.Fatal("expected Redis grant reservation to succeed")
	}
	if !reserveRegistrationEmailGrant(grant, "user@example.com", reservationOwner) {
		t.Fatal("expected the same Redis reservation owner to retry idempotently")
	}
	if _, ok := ReserveRegistrationEmailGrant(grant, "user@example.com"); ok {
		t.Fatal("a different Redis reservation owner must not share the grant")
	}
	if !RollbackRegistrationEmailGrantReservation(grant, "user@example.com", reservationOwner) {
		t.Fatal("expected Redis grant reservation rollback to succeed")
	}
	if !VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("rolled back Redis grant must be available for retry")
	}
	reservationOwner, ok = ReserveRegistrationEmailGrant(grant, "user@example.com")
	if !ok || reservationOwner == "" {
		t.Fatal("expected rolled back Redis grant to be reservable")
	}
	CommitRegistrationEmailGrantReservation(grant, "user@example.com", reservationOwner)
	if VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("committed grant reservation must remain consumed")
	}
	if RollbackRegistrationEmailGrantReservation(grant, "user@example.com", reservationOwner) {
		t.Fatal("committed grant reservation must not roll back")
	}
}

func TestRegistrationEmailGrantRedisRollbackRetriesAmbiguousResult(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()
	resetRegistrationEmailVerificationStore()

	grant, err := RegisterRegistrationEmailGrant("user@example.com")
	if err != nil {
		t.Fatalf("register grant: %v", err)
	}
	reservationOwner, ok := ReserveRegistrationEmailGrant(grant, "user@example.com")
	if !ok {
		t.Fatal("expected Redis grant reservation to succeed")
	}

	hook := &failFirstEvalAfterProcessHook{}
	RDB.AddHook(hook)
	if !RollbackRegistrationEmailGrantReservation(grant, "user@example.com", reservationOwner) {
		t.Fatal("rollback must retry an ambiguous Redis result with the same owner")
	}
	if !hook.failed.Load() {
		t.Fatal("expected the first rollback result to be made ambiguous")
	}
	if !VerifyRegistrationEmailGrant(grant, "user@example.com") {
		t.Fatal("retried rollback must restore the grant")
	}
}

func TestRegistrationEmailLinkRedisFailureFailsClosed(t *testing.T) {
	mr, cleanup := setupMiniredis(t)
	defer cleanup()
	resetRegistrationEmailVerificationStore()
	mr.Close()

	if _, err := RegisterRegistrationEmailLink("user@example.com"); err == nil {
		t.Fatal("expected Redis write failure to fail closed")
	}
	if _, err := RegisterRegistrationEmailGrant("user@example.com"); err == nil {
		t.Fatal("expected Redis grant write failure to fail closed")
	}
}
