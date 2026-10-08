use crate::domain::models::{Paths, Secrets};
use crate::error::Result;
use std::env;
use std::io::{self, IsTerminal, Write};
use std::path::PathBuf;

const DEFAULT_BASE_URL: &str = "http://mochi:4000/v1";

pub fn paths() -> Paths {
    let config_root = env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home().join(".config"));
    let opencode_home = env::var_os("OPENCODE_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home().join(".opencode"));
    Paths {
        config_dir: config_root.join("opencode"),
        bin_dir: opencode_home.join("bin"),
    }
}

fn home() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn secrets() -> Result<Secrets> {
    let base_url = env::var("MOCHI_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
    let api_key = match env::var("MOCHI_API_KEY") {
        Ok(value) if !value.is_empty() => value,
        _ => prompt_api_key()?,
    };
    Ok(Secrets { base_url, api_key })
}

fn prompt_api_key() -> Result<String> {
    if !io::stdin().is_terminal() {
        return Ok("CHANGE_ME".to_string());
    }
    eprint!("\u{1f338} Mochi API key (blank = leave placeholder): ");
    io::stderr()
        .flush()
        .map_err(|e| crate::error::Error::io("flush prompt", e))?;
    let mut buffer = String::new();
    io::stdin()
        .read_line(&mut buffer)
        .map_err(|e| crate::error::Error::io("read api key", e))?;
    let trimmed = buffer.trim();
    Ok(if trimmed.is_empty() {
        "CHANGE_ME".to_string()
    } else {
        trimmed.to_string()
    })
}

pub fn skip_karakuri() -> bool {
    matches!(env::var("SKIP_KARAKURI"), Ok(value) if value == "1")
}
