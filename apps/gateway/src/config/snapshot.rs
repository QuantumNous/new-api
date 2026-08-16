use std::sync::{Arc, RwLock};

use super::revision::RoutingRevision;

/// An immutable snapshot tagged with the revision that produced it.
#[derive(Debug)]
pub struct VersionedSnapshot<T> {
    pub revision: RoutingRevision,
    pub value: T,
}

/// Outcome of [`SnapshotStore::install`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapshotInstall {
    /// A strictly higher revision replaced the active snapshot.
    Installed,
    /// The revision was not higher than the active one; the store is unchanged.
    Ignored,
}

/// A monotonic, immutable snapshot store.
///
/// Holds the active snapshot behind `Arc<RwLock<Option<Arc<VersionedSnapshot<T>>>>>`.
/// `install()` only accepts a strictly higher revision; lower or equal revisions
/// are ignored so the active snapshot never regresses. `snapshot()` returns one
/// `Arc` clone — a request holding that `Arc` keeps the old value alive even after
/// a subsequent `install()` swaps the store's pointer.
pub struct SnapshotStore<T> {
    inner: Arc<RwLock<Option<Arc<VersionedSnapshot<T>>>>>,
}

impl<T> Default for SnapshotStore<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T> Clone for SnapshotStore<T> {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

impl<T> SnapshotStore<T> {
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(None)),
        }
    }

    /// Returns the current snapshot as an `Arc` clone, or `None` if nothing has
    /// been installed yet. The lock is released before returning; the caller's
    /// `Arc` keeps the snapshot live independently of later installs.
    pub fn snapshot(&self) -> Option<Arc<VersionedSnapshot<T>>> {
        self.inner.read().expect("snapshot lock poisoned").clone()
    }

    /// Installs `new_snapshot` only if its revision is strictly higher than the
    /// active revision. Returns `Ignored` for lower/equal revisions; the store
    /// is unchanged and in-flight `Arc`s from prior reads remain valid.
    pub fn install(&self, new_snapshot: Arc<VersionedSnapshot<T>>) -> SnapshotInstall {
        let mut guard = self.inner.write().expect("snapshot lock poisoned");
        match guard.as_ref() {
            Some(current) if new_snapshot.revision <= current.revision => SnapshotInstall::Ignored,
            _ => {
                *guard = Some(new_snapshot);
                SnapshotInstall::Installed
            }
        }
    }

    /// Convenience: build and install a snapshot from its parts.
    pub fn install_value(&self, revision: RoutingRevision, value: T) -> SnapshotInstall {
        self.install(Arc::new(VersionedSnapshot { revision, value }))
    }
}
