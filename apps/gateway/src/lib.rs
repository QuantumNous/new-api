//! Gateway config core: validated routing revision, read-only revision reader,
//! and a generic monotonic snapshot store.
//!
//! This crate deliberately holds no binary, HTTP layer, or business typed
//! snapshot types; those arrive in later issues of the rewrite epic.

pub mod config;

pub use config::{
    RevisionReadError, RevisionReader, RoutingRevision, SnapshotInstall, SnapshotStore,
    VersionedSnapshot,
};
