use std::sync::Arc;

use gateway::config::snapshot::SnapshotInstall;
use gateway::{
    RevisionReadError, RevisionReader, RoutingRevision, SnapshotStore, VersionedSnapshot,
};

/// Helper: create an in-memory SQLite pool backed by the singleton revision
/// table. No migrations are run by the code under test; the table is created
/// here purely as a test fixture.
///
/// The pool is pinned to a single connection: a sqlx `sqlite::memory:` pool
/// gives each pooled connection its own private in-memory database, so a
/// `CREATE TABLE` on one connection is invisible to queries on another. With
/// `max_connections(1)` every query reuses the connection where the fixture
/// created the table.
async fn sqlite_pool_with_rows(routing_revision: Option<Option<i64>>) -> sqlx::AnyPool {
    let pool = single_connection_sqlite_pool(
        "CREATE TABLE gateway_config_revisions (id INTEGER PRIMARY KEY, routing_revision INTEGER NOT NULL)",
    )
    .await;
    if let Some(rev) = routing_revision {
        sqlx::query("INSERT INTO gateway_config_revisions (id, routing_revision) VALUES (1, ?)")
            .bind(rev)
            .execute(&pool)
            .await
            .expect("insert row");
    }
    pool
}

/// Helper: create a single-connection in-memory SQLite pool and run `schema`
/// against it. See [`sqlite_pool_with_rows`] for why a single connection is
/// required.
async fn single_connection_sqlite_pool(schema: &str) -> sqlx::AnyPool {
    sqlx::any::install_default_drivers();
    let pool = sqlx::any::AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("connect sqlite");
    sqlx::query(schema)
        .execute(&pool)
        .await
        .expect("create table");
    pool
}

#[tokio::test]
async fn reader_returns_valid_revision() {
    let pool = sqlite_pool_with_rows(Some(Some(42))).await;
    let reader = RevisionReader::new(pool);
    let rev = reader.current().await.unwrap();
    assert_eq!(rev.get(), 42);
}

#[tokio::test]
async fn reader_rejects_missing_row() {
    let pool = sqlite_pool_with_rows(None).await;
    let reader = RevisionReader::new(pool);
    assert!(matches!(
        reader.current().await,
        Err(RevisionReadError::Missing)
    ));
}

#[tokio::test]
async fn reader_rejects_zero_revision() {
    let pool = sqlite_pool_with_rows(Some(Some(0))).await;
    let reader = RevisionReader::new(pool);
    assert!(matches!(
        reader.current().await,
        Err(RevisionReadError::Invalid)
    ));
}

#[tokio::test]
async fn reader_rejects_negative_revision() {
    let pool = sqlite_pool_with_rows(Some(Some(-5))).await;
    let reader = RevisionReader::new(pool);
    assert!(matches!(
        reader.current().await,
        Err(RevisionReadError::Invalid)
    ));
}

#[tokio::test]
async fn reader_rejects_null_revision() {
    // Insert NULL explicitly to simulate a schema where the column is nullable.
    let pool = single_connection_sqlite_pool(
        "CREATE TABLE gateway_config_revisions (id INTEGER PRIMARY KEY, routing_revision INTEGER)",
    )
    .await;
    sqlx::query("INSERT INTO gateway_config_revisions (id, routing_revision) VALUES (1, NULL)")
        .execute(&pool)
        .await
        .unwrap();
    let reader = RevisionReader::new(pool);
    assert!(matches!(
        reader.current().await,
        Err(RevisionReadError::Invalid)
    ));
}

#[test]
fn routing_revision_try_from_accepts_positive() {
    assert_eq!(RoutingRevision::try_from(1).unwrap().get(), 1);
    assert_eq!(RoutingRevision::try_from(i64::MAX).unwrap().get(), i64::MAX);
}

#[test]
fn routing_revision_try_from_rejects_zero_and_negative() {
    assert!(matches!(
        RoutingRevision::try_from(0),
        Err(RevisionReadError::Invalid)
    ));
    assert!(matches!(
        RoutingRevision::try_from(-1),
        Err(RevisionReadError::Invalid)
    ));
}

#[test]
fn snapshot_store_monotonic_install() {
    let store = SnapshotStore::new();
    assert!(store.snapshot().is_none());

    let r1 = RoutingRevision::try_from(1).unwrap();
    let r2 = RoutingRevision::try_from(2).unwrap();
    let r3 = RoutingRevision::try_from(3).unwrap();

    assert_eq!(
        store.install_value(r2, "second"),
        SnapshotInstall::Installed
    );
    assert_eq!(store.snapshot().unwrap().revision, r2);

    // Lower revision must not replace.
    assert_eq!(store.install_value(r1, "first"), SnapshotInstall::Ignored);
    assert_eq!(store.snapshot().unwrap().revision, r2);
    assert_eq!(&store.snapshot().unwrap().value, &"second");

    // Equal revision must not replace.
    assert_eq!(
        store.install_value(r2, "second-dup"),
        SnapshotInstall::Ignored
    );
    assert_eq!(&store.snapshot().unwrap().value, &"second");

    // Higher revision replaces.
    assert_eq!(store.install_value(r3, "third"), SnapshotInstall::Installed);
    assert_eq!(store.snapshot().unwrap().revision, r3);
    assert_eq!(&store.snapshot().unwrap().value, &"third");
}

#[test]
fn snapshot_store_preserves_old_arc_after_install() {
    let store = SnapshotStore::new();
    let r1 = RoutingRevision::try_from(1).unwrap();
    let r2 = RoutingRevision::try_from(2).unwrap();

    store.install_value(r1, "old");
    let held = store.snapshot().unwrap();
    assert!(Arc::ptr_eq(&held, &store.snapshot().unwrap()));

    store.install_value(r2, "new");
    // The store now points to "new", but the held Arc still sees "old".
    assert_eq!(&store.snapshot().unwrap().value, &"new");
    assert_eq!(&held.value, &"old");
    assert!(!Arc::ptr_eq(&held, &store.snapshot().unwrap()));
}

#[test]
fn snapshot_store_clone_shares_state() {
    let store = SnapshotStore::new();
    let cloned = store.clone();
    let r1 = RoutingRevision::try_from(1).unwrap();
    store.install_value(r1, "data");
    assert_eq!(&cloned.snapshot().unwrap().value, &"data");
}

#[test]
fn versioned_snapshot_holds_revision_and_value() {
    let rev = RoutingRevision::try_from(7).unwrap();
    let snap = VersionedSnapshot {
        revision: rev,
        value: 42_i32,
    };
    assert_eq!(snap.revision, rev);
    assert_eq!(snap.value, 42);
}
