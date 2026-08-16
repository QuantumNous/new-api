use std::num::NonZeroI64;

use thiserror::Error;

/// Errors surfaced when reading or validating a routing revision.
#[derive(Debug, Error)]
pub enum RevisionReadError {
    #[error("gateway config revision singleton row is missing")]
    Missing,
    #[error("gateway config revision is invalid")]
    Invalid,
    #[error(transparent)]
    Sql(#[from] sqlx::Error),
}

/// A validated, globally monotonic routing revision watermark.
#[derive(Copy, Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub struct RoutingRevision(NonZeroI64);

impl RoutingRevision {
    #[must_use]
    pub const fn new(value: NonZeroI64) -> Self {
        Self(value)
    }
    #[must_use]
    pub const fn get(self) -> i64 {
        self.0.get()
    }
}

impl TryFrom<i64> for RoutingRevision {
    type Error = RevisionReadError;
    fn try_from(raw: i64) -> Result<Self, Self::Error> {
        NonZeroI64::new(raw)
            .filter(|nz| nz.get() > 0)
            .map(Self)
            .ok_or(RevisionReadError::Invalid)
    }
}
