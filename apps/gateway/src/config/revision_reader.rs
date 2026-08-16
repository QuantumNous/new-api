use sqlx::AnyPool;

use super::revision::{RevisionReadError, RoutingRevision};

/// The singleton revision row id; one deployment-wide routing watermark.
const REVISION_ROW_ID: i64 = 1;

/// Read-only reader for the global routing revision watermark.
///
/// Only executes `SELECT routing_revision FROM gateway_config_revisions WHERE id = 1`;
/// never runs migrations or writes to the database.
#[derive(Clone)]
pub struct RevisionReader {
    pool: AnyPool,
}

impl RevisionReader {
    #[must_use]
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    /// Returns the current committed routing revision, or an error if the
    /// singleton row is missing or holds an invalid (NULL/zero/negative) value.
    pub async fn current(&self) -> Result<RoutingRevision, RevisionReadError> {
        let row: Option<(Option<i64>,)> =
            sqlx::query_as("SELECT routing_revision FROM gateway_config_revisions WHERE id = ?")
                .bind(REVISION_ROW_ID)
                .fetch_optional(&self.pool)
                .await?;

        match row {
            None => Err(RevisionReadError::Missing),
            Some((None,)) => Err(RevisionReadError::Invalid),
            Some((Some(raw),)) => RoutingRevision::try_from(raw),
        }
    }
}
