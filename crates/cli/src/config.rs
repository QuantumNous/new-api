//! Config precedence: CLI flag > env > TOML file.
//! `~/.config/newapi-cli.toml` is the file; `<env_prefix>_BASE_URL` / `_TOKEN` env.
//! Errors never reveal the token.

use anyhow::{anyhow, bail, Result};
use std::fs;
use std::path::PathBuf;

use crate::brand::BRAND;
pub struct Config {
    pub base_url: String,
    // Token intentionally omitted from `Debug` so accidental formatting
    // (logs, error context, panics) never leaks the bearer token.
    pub token: String,
}

impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("base_url", &self.base_url)
            .field("token", &"<redacted>")
            .finish()
    }
}

pub fn load_config(cli_url: Option<&str>, cli_token: Option<&str>) -> Result<Config> {
    let file_url = read_file_url();
    let env_url = std::env::var(format!("{}_BASE_URL", BRAND.env_prefix)).ok();
    let env_token = std::env::var(format!("{}_TOKEN", BRAND.env_prefix)).ok();

    let base_url = cli_url
        .map(|s| s.to_string())
        .or(env_url)
        .or(file_url)
        .ok_or_else(|| {
            anyhow!(
                "missing base URL: pass --url, ${}_BASE_URL, or set it in {}",
                BRAND.env_prefix,
                config_path().display()
            )
        })?;

    let token = cli_token
        .map(|s| s.to_string())
        .or(env_token)
        .ok_or_else(|| {
            anyhow!(
                "missing token: pass --token or set ${}_TOKEN",
                BRAND.env_prefix
            )
        })?;

    if token.is_empty() {
        bail!("invalid token: token must not be empty");
    }

    Ok(Config {
        base_url: normalize_base_url(&base_url)?,
        token,
    })
}

fn normalize_base_url(raw: &str) -> Result<String> {
    let url = raw.trim_end_matches('/');
    if url.is_empty() {
        bail!("invalid base URL");
    }
    Ok(url.to_string())
}

fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(BRAND.config_file)
}

fn read_file_url() -> Option<String> {
    let path = config_path();
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(&path).ok()?;
    let parsed: toml::Value = toml::from_str(&content).ok()?;
    parsed
        .get("base_url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trims_trailing_slash() {
        assert_eq!(
            normalize_base_url("http://localhost:3000/").unwrap(),
            "http://localhost:3000"
        );
        assert_eq!(
            normalize_base_url("http://localhost:3000///").unwrap(),
            "http://localhost:3000"
        );
        assert_eq!(
            normalize_base_url("http://localhost:3000").unwrap(),
            "http://localhost:3000"
        );
    }

    #[test]
    fn rejects_empty_base_url() {
        assert!(normalize_base_url("").is_err());
        assert!(normalize_base_url("///").is_err());
    }

    #[test]
    fn precedence_flag_over_env() {
        std::env::set_var("NEWAPI_CLI_BASE_URL", "http://from-env.invalid");
        std::env::set_var("NEWAPI_CLI_TOKEN", "env-token");
        let cfg = load_config(Some("http://flag.invalid"), Some("flag-token")).unwrap();
        assert_eq!(cfg.base_url, "http://flag.invalid");
        assert_eq!(cfg.token, "flag-token");
        std::env::remove_var("NEWAPI_CLI_BASE_URL");
        std::env::remove_var("NEWAPI_CLI_TOKEN");
    }

    #[test]
    fn empty_token_errors() {
        let result = load_config(Some("http://localhost:3000"), Some(""));
        assert!(result.is_err());
        // The error must not include the token value (it is empty anyway, but verify message)
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("token"));
    }

    #[test]
    fn missing_url_and_token_errors() {
        std::env::remove_var("NEWAPI_CLI_BASE_URL");
        std::env::remove_var("NEWAPI_CLI_TOKEN");
        let result = load_config(None, None);
        assert!(result.is_err());
    }
}
