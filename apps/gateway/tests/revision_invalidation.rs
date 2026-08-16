use gateway::config::invalidation::{
    INVALIDATION_CHANNEL, InvalidationStatus, Notice, RevisionTarget, reconcile,
};
use gateway::{RevisionReadError, RevisionReader, RoutingRevision};
use sqlx::any::AnyPoolOptions;

async fn sqlite_pool(revision: Option<i64>) -> sqlx::AnyPool {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("connect sqlite");
    sqlx::query("CREATE TABLE gateway_config_revisions (id INTEGER PRIMARY KEY, routing_revision INTEGER NOT NULL)")
        .execute(&pool)
        .await
        .expect("create table");
    if let Some(revision) = revision {
        sqlx::query("INSERT INTO gateway_config_revisions (id, routing_revision) VALUES (1, ?)")
            .bind(revision)
            .execute(&pool)
            .await
            .expect("insert revision");
    }
    pool
}

#[test]
fn notice_parser_is_strict_and_positive() {
    let notice = Notice::parse(br#"{"routing_revision": 7}"#).unwrap();
    assert_eq!(
        notice.routing_revision(),
        RoutingRevision::try_from(7).unwrap()
    );
    assert_eq!(INVALIDATION_CHANNEL, "new-api:gateway:routing-revision:v1");
    for payload in [
        br#"{}"#.as_slice(),
        br#"{"routing_revision": 0}"#,
        br#"{"routing_revision": -1}"#,
        br#"{"routing_revision": 1, "extra": true}"#,
        b"not-json",
    ] {
        assert!(Notice::parse(payload).is_err());
    }
}

#[tokio::test]
async fn target_only_advances_and_reconcile_reads_db() {
    let pool = sqlite_pool(Some(5)).await;
    let reader = RevisionReader::new(pool.clone());
    let target = RevisionTarget::new();
    let receiver = target.receiver();
    assert!(target.advance(RoutingRevision::try_from(5).unwrap()));
    assert!(!target.advance(RoutingRevision::try_from(3).unwrap()));
    assert!(!target.advance(RoutingRevision::try_from(5).unwrap()));
    assert_eq!(receiver.current().unwrap().get(), 5);

    let mut status = InvalidationStatus::default();
    let class = reconcile(&reader, &target, &mut status).await;
    assert_eq!(
        class,
        gateway::config::invalidation::ReconcileClass::NoChange
    );
    assert_eq!(receiver.current().unwrap().get(), 5);

    sqlx::query("UPDATE gateway_config_revisions SET routing_revision = 8 WHERE id = 1")
        .execute(&pool)
        .await
        .unwrap();
    let class = reconcile(&reader, &target, &mut status).await;
    assert_eq!(
        class,
        gateway::config::invalidation::ReconcileClass::Advanced
    );
    assert_eq!(receiver.current().unwrap().get(), 8);
}

#[tokio::test]
async fn reconcile_keeps_target_on_db_error() {
    let pool = sqlite_pool(None).await;
    let reader = RevisionReader::new(pool);
    let target = RevisionTarget::new();
    let mut status = InvalidationStatus::default();
    let class = reconcile(&reader, &target, &mut status).await;
    assert_eq!(class, gateway::config::invalidation::ReconcileClass::Error);
    assert!(target.receiver().current().is_none());
    assert!(matches!(
        reader.current().await,
        Err(RevisionReadError::Missing)
    ));
}
