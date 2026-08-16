//! Shared brand metadata. The only place the project name lives.
//! Rename here and every env var, config path, and clap name follows.

#[derive(Debug, Clone, Copy)]
pub struct Brand {
    pub bin_name: &'static str,
    pub env_prefix: &'static str,
    pub config_file: &'static str,
}

pub const BRAND: Brand = Brand {
    bin_name: "newapi-cli",
    env_prefix: "NEWAPI_CLI",
    config_file: "newapi-cli.toml",
};
