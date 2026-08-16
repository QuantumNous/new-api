//! Invalidation channel: strict notice parsing, monotonic revision target,
//! status tracking, and DB-grounded reconciliation.
//!
//! The invalidation channel carries a single integer — the routing revision
//! the sender believes is active. That integer is **advisory only**: it is
//! never trusted as the source of truth. [`reconcile`] ignores the notice
//! integer entirely and re-reads the committed watermark from the database via
//! [`RevisionReader`], then advances [`RevisionTarget`] only to a strictly
//! higher value. This is by design — a notice is a *hint to reconcile*, not a
//! command, so a compromised or buggy sender cannot force a regression.

use std::num::NonZeroI64;
use std::time::Instant;

use serde::Deserialize;
use tokio::sync::watch;

use super::revision::RoutingRevision;
use super::revision_reader::RevisionReader;

/// The exact channel name carried by invalidation notices.
///
/// Senders and receivers must match this string byte-for-byte; it is the
/// contract that binds a notice to this handler.
pub const INVALIDATION_CHANNEL: &str = "new-api:gateway:routing-revision:v1";

/// Errors surfaced while parsing an invalidation notice from a raw channel
/// payload. Raw bytes are never retained on errors, so a malformed or hostile
/// payload cannot leak beyond this boundary.
#[derive(Debug, thiserror::Error)]
pub enum NoticeParseError {
    #[error("invalidation notice was not valid JSON")]
    InvalidJson,
    #[error("invalidation notice rejected: {0}")]
    Rejected(&'static str),
}

/// A strictly-parsed invalidation notice. Carries only the integer_watermark
/// hint; the payload is consumed and never retained in raw form.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Notice {
    routing_revision: NonZeroI64,
}

impl Notice {
    #[must_use]
    pub const fn routing_revision(self) -> RoutingRevision {
        RoutingRevision::new(self.routing_revision)
    }
}

/// The wire shape of an invalidation notice. `deny_unknown_fields` enforces
/// strict forward-compatible parsing: an unexpected field is a protocol error,
/// not a silent extension. Parsing consumes the bytes; the parser never stores
/// the original payload, so a malformed or hostile message cannot linger.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct NoticeWire {
    routing_revision: i64,
}

impl Notice {
    /// Parse `raw` as a strict invalidation notice.
    ///
    /// Rejects:
    /// - malformed JSON (any serde_json error),
    /// - a missing `routing_revision` field,
    /// - `routing_revision` of `0` or any negative value,
    /// - any unknown field.
    ///
    /// The raw payload is never retained; only the validated integer survives.
    #[must_use]
    pub fn parse(raw: &[u8]) -> Result<Self, NoticeParseError> {
        let wire: NoticeWire =
            serde_json::from_slice(raw).map_err(|_e| NoticeParseError::InvalidJson)?;

        let nz = NonZeroI64::new(wire.routing_revision)
            .filter(|nz| nz.get() > 0)
            .ok_or(NoticeParseError::Rejected(
                "revision must be a positive non-zero integer",
            ))?;
        Ok(Self {
            routing_revision: nz,
        })
    }
}

/// Classifies the outcome of a single [`reconcile`] pass.
///
/// `Advanced` means the target moved strictly forward; `NoChange` means the DB
/// watermark was not higher than the target (or the target was unset and the DB
/// reported `Missing`, which leaves the target where it was). `Error` means the
/// DB read itself failed — the target is never touched on error.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReconcileClass {
    /// The target advanced to a strictly higher revision.
    Advanced,
    /// The DB watermark was not higher than the target; nothing changed.
    NoChange,
    /// Reading the DB failed; the target was not advanced.
    Error,
}

/// A monotonic revision target backed by a [`tokio::sync::watch`] channel.
///
/// The sender side advances the watermark; [`RevisionTarget::receiver`] hands
/// out cheap clone-able receivers that observe the current value without polling
/// the DB. Advance is strictly monotonic: a value not greater than the current
/// watermark is silently ignored, so the target never regresses.
#[derive(Debug)]
pub struct RevisionTarget {
    tx: watch::Sender<Option<RoutingRevision>>,
}

impl RevisionTarget {
    /// Create a fresh target with no watermark yet installed.
    #[must_use]
    pub fn new() -> Self {
        let (tx, _rx) = watch::channel(None);
        Self { tx }
    }

    /// Advance the target to `rev` only if it is strictly greater than the
    /// current watermark. Lower or equal values are ignored. Returns `true` if
    /// the target advanced.
    ///
    /// Cancellation-safe: this is a synchronous non-async operation; there is
    /// no await point and hence no held resource to leak on cancellation.
    pub fn advance(&self, rev: RoutingRevision) -> bool {
        let current = *self.tx.borrow();
        match current {
            Some(cur) if rev <= cur => false,
            _ => {
                // `send` cannot fail: we hold the only sender, and `send_replace`
                // updates the watched value iff every receiver dropped.
                let _ = self.tx.send_replace(Some(rev));
                true
            }
        }
    }

    /// A cheap clone-able receiver over the current watermark. Does not leak
    /// raw secrets — `RoutingRevision` is a plain integer watermark with no
    /// bearer material.
    #[must_use]
    pub fn receiver(&self) -> RevisionTargetReceiver {
        RevisionTargetReceiver {
            rx: self.tx.subscribe(),
        }
    }

    /// The highest watermark ever advanced to, or `None` if untouched.
    #[must_use]
    pub fn current(&self) -> Option<RoutingRevision> {
        *self.tx.borrow()
    }
}

impl Default for RevisionTarget {
    fn default() -> Self {
        Self::new()
    }
}

/// A receiver handle to [`RevisionTarget`]. Borrows the current watermark
/// without touching the DB and without retaining any secret material.
#[derive(Debug, Clone)]
pub struct RevisionTargetReceiver {
    rx: watch::Receiver<Option<RoutingRevision>>,
}

impl RevisionTargetReceiver {
    /// The current watermark, without blocking or polling the DB.
    #[must_use]
    pub fn current(&self) -> Option<RoutingRevision> {
        *self.rx.borrow()
    }
}

/// Snapshot of the invalidation subsystem's health used for status exposure.
///
/// `redis_connected` defaults to `false`; this crate holds no Redis client, so
/// the field is set externally (and is `false` until wired). Timestamps use
/// [`Instant`] (monotonic) so they are safe to compare and never expose wall
/// clock skew.
#[derive(Debug, Clone, Default)]
pub struct InvalidationStatus {
    /// The highest revision the target has advanced to.
    pub last_target: Option<RoutingRevision>,
    /// Monotonic instant of the last completed reconcile pass.
    pub last_reconcile_at: Option<Instant>,
    /// Outcome class of the last reconcile pass.
    pub last_reconcile_class: Option<ReconcileClass>,
    /// Whether the upstream Redis channel is currently connected.
    /// `false` until an external runner sets it; this crate does not own a
    /// client and so never reports `true` on its own.
    pub redis_connected: bool,
}

/// Reconcile the advisory target against the database's committed watermark.
///
/// Reads `reader.current()` — the source of truth — and, if it is strictly
/// higher than the target's current watermark, advances the target. The
/// notice integer is never consulted here: a notice merely *triggers* a
/// reconcile, it does not dictate the resulting watermark.
///
/// On a DB read error the target is left untouched and `ReconcileClass::Error`
/// is recorded. This is cancellation-safe: the only await point is the DB read
/// inside [`RevisionReader`]; no locks are held across it, so dropping the
/// future mid-read leaves the target exactly as it was.
pub async fn reconcile(
    reader: &RevisionReader,
    target: &RevisionTarget,
    status: &mut InvalidationStatus,
) -> ReconcileClass {
    status.last_reconcile_at = Some(Instant::now());

    let class = match reader.current().await {
        Ok(db_rev) if target.advance(db_rev) => {
            status.last_target = Some(db_rev);
            ReconcileClass::Advanced
        }
        Ok(_) => ReconcileClass::NoChange,
        Err(_) => ReconcileClass::Error,
    };
    status.last_reconcile_class = Some(class);
    class
}
