//! HTTP client + envelope/error handling. Single implementation.
//! Bearer PAT, JSON-first, handles non-2xx, `success:false`, non-JSON, network errors.
//! Never echoes the token in any error message.

use anyhow::{anyhow, bail, Result};
use reqwest::blocking::Client;
use reqwest::StatusCode;
use serde_json::Value;

pub struct ApiClient {
    base_url: String,
    http: Client,
    token: String,
}

impl ApiClient {
    pub fn new(base_url: String, token: String) -> Result<Self> {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| anyhow!("failed to build HTTP client: {}", e))?;
        Ok(Self {
            base_url,
            http,
            token,
        })
    }

    fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<&Value>,
    ) -> Result<Value> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self
            .http
            .request(method.clone(), &url)
            .bearer_auth(&self.token);
        if !query.is_empty() {
            req = req.query(query);
        }
        if let Some(b) = body {
            req = req.json(b);
        }
        let resp = req
            .send()
            .map_err(|e| anyhow!("request failed: {}", redact_url_err(e)))?;
        let status = resp.status();
        let text = resp
            .text()
            .map_err(|e| anyhow!("failed to read response body: {}", e))?;
        parse_response(status, &text)
    }

    /// Same as `request` but skips the `success` envelope check. Used for
    /// endpoints (e.g. /api/option) that return their own JSON shape rather
    /// than the standard `{success,data,message}` envelope.
    fn request_raw(
        &self,
        method: reqwest::Method,
        path: &str,
        query: &[(&str, String)],
    ) -> Result<Value> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self.http.request(method, &url).bearer_auth(&self.token);
        if !query.is_empty() {
            req = req.query(query);
        }
        let resp = req
            .send()
            .map_err(|e| anyhow!("request failed: {}", redact_url_err(e)))?;
        let status = resp.status();
        let text = resp
            .text()
            .map_err(|e| anyhow!("failed to read response body: {}", e))?;
        parse_response_no_envelope(status, &text)
    }

    pub fn get(&self, path: &str, query: &[(&str, String)]) -> Result<Value> {
        self.request(reqwest::Method::GET, path, query, None)
    }

    /// GET that skips the `success` envelope check. Used for endpoints
    /// like `/api/option` that return a key→value object directly.
    pub fn get_raw(&self, path: &str, query: &[(&str, String)]) -> Result<Value> {
        self.request_raw(reqwest::Method::GET, path, query)
    }

    pub fn post_json(&self, path: &str, body: &Value) -> Result<Value> {
        self.request(reqwest::Method::POST, path, &[], Some(body))
    }

    /// POST with query params and no JSON body (e.g. channel copy).
    pub fn post_with_query(&self, path: &str, query: &[(&str, String)]) -> Result<Value> {
        self.request(reqwest::Method::POST, path, query, None)
    }

    pub fn put_json(&self, path: &str, body: &Value) -> Result<Value> {
        self.request(reqwest::Method::PUT, path, &[], Some(body))
    }

    pub fn patch_json(&self, path: &str, body: &Value) -> Result<Value> {
        self.request(reqwest::Method::PATCH, path, &[], Some(body))
    }

    pub fn delete(&self, path: &str) -> Result<Value> {
        self.request(reqwest::Method::DELETE, path, &[], None)
    }

    /// DELETE with query params and no JSON body (e.g. log-files cleanup).
    pub fn delete_with_query(&self, path: &str, query: &[(&str, String)]) -> Result<Value> {
        self.request(reqwest::Method::DELETE, path, query, None)
    }

    pub fn delete_json(&self, path: &str, body: &Value) -> Result<Value> {
        self.request(reqwest::Method::DELETE, path, &[], Some(body))
    }
}

fn parse_response(status: StatusCode, text: &str) -> Result<Value> {
    if text.is_empty() {
        if status.is_success() {
            return Ok(Value::Null);
        }
        bail!("HTTP {}: empty response body", status);
    }
    let value: Value =
        serde_json::from_str(text).map_err(|_| anyhow!("HTTP {}: non-JSON response", status))?;
    if !status.is_success() {
        let msg = value
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("request failed");
        bail!("HTTP {}: {}", status, msg);
    }
    if let Some(success) = value.get("success").and_then(|s| s.as_bool()) {
        if !success {
            let msg = value
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("request failed");
            bail!("{}", msg);
        }
    }
    Ok(value)
}

fn parse_response_no_envelope(status: StatusCode, text: &str) -> Result<Value> {
    if text.is_empty() {
        if status.is_success() {
            return Ok(Value::Null);
        }
        bail!("HTTP {}: empty response body", status);
    }
    let value: Value =
        serde_json::from_str(text).map_err(|_| anyhow!("HTTP {}: non-JSON response", status))?;
    if !status.is_success() {
        let msg = value
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("request failed");
        bail!("HTTP {}: {}", status, msg);
    }
    Ok(value)
}

/// Strip bearer/query details from network errors so the token and
/// upstream URLs never reach logs. `reqwest::Error::to_string` may embed
/// the original URL including path/query; we replace that with a stable
/// short message.
fn redact_url_err(e: reqwest::Error) -> String {
    let _ = e; // intentionally dropped
    "network request failed".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_success_envelope_ok() {
        let v = parse_response(StatusCode::OK, r#"{"success":true,"data":1}"#).unwrap();
        assert_eq!(v["data"], 1);
    }

    #[test]
    fn parse_envelope_success_false_errors() {
        let err =
            parse_response(StatusCode::OK, r#"{"success":false,"message":"nope"}"#).unwrap_err();
        assert_eq!(err.to_string(), "nope");
    }

    #[test]
    fn parse_non_success_status_errors() {
        let err = parse_response(
            StatusCode::UNAUTHORIZED,
            r#"{"success":false,"message":"invalid token"}"#,
        )
        .unwrap_err();
        assert!(err.to_string().contains("401"));
        assert!(err.to_string().contains("invalid token"));
    }

    #[test]
    fn parse_non_json_errors() {
        let err = parse_response(StatusCode::OK, "not json").unwrap_err();
        assert!(err.to_string().contains("non-JSON"));
    }

    #[test]
    fn parse_empty_success_ok() {
        let v = parse_response(StatusCode::NO_CONTENT, "").unwrap();
        assert!(v.is_null());
    }
}
