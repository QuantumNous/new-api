//! Inline JSON or `@file` input parser.

use anyhow::{anyhow, Result};
use serde_json::Value;
use std::fs;

pub fn read_json_arg(value: &str) -> Result<Value> {
    if let Some(stripped) = value.strip_prefix('@') {
        let content = fs::read_to_string(stripped)
            .map_err(|e| anyhow!("failed to read file {}: {}", stripped, e))?;
        serde_json::from_str(&content)
            .map_err(|e| anyhow!("invalid JSON in file {}: {}", stripped, e))
    } else {
        serde_json::from_str(value).map_err(|e| anyhow!("invalid inline JSON: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn inline_json_parses() {
        let v = read_json_arg(r#"{"a":1}"#).unwrap();
        assert_eq!(v["a"], 1);
    }

    #[test]
    fn inline_invalid_errors() {
        assert!(read_json_arg("not json").is_err());
    }

    #[test]
    fn file_json_parses() {
        let path = std::env::temp_dir().join(format!("cli_json_input_{}.json", std::process::id()));
        {
            let mut f = fs::File::create(&path).unwrap();
            writeln!(f, r#"{{"b":2}}"#).unwrap();
        }
        let v = read_json_arg(&format!("@{}", path.display())).unwrap();
        assert_eq!(v["b"], 2);
        fs::remove_file(&path).ok();
    }

    #[test]
    fn missing_file_errors() {
        assert!(read_json_arg("@/nonexistent/path/zzz.json").is_err());
    }
}
