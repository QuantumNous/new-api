//! Output: JSON default. Table deferred to Phase 2.

use anyhow::Result;
use serde_json::Value;

pub fn print_json(value: &Value) -> Result<()> {
    let pretty = serde_json::to_string_pretty(value).unwrap_or_else(|_| "null".to_string());
    println!("{}", pretty);
    Ok(())
}
