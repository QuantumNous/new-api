//! BoxAI-owned services.
//!
//! Everything in here has no upstream analog: the BoxAI desktop authorization
//! flow and the account-scoped surfaces that follow from it.
//!
//! The fixed BoxAI provider and any official MCP servers are seeded into
//! upstream's own provider / MCP stores rather than written into client config
//! files from here. Upstream owns those files; a second writer for the same
//! paths is how configuration gets corrupted.

pub mod gateway_auth;
pub mod mcp_seed;
pub mod provider_seed;
