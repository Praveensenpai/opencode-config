use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Paths {
    pub config_dir: PathBuf,
    pub bin_dir: PathBuf,
}

#[derive(Debug, Clone)]
pub struct Secrets {
    pub base_url: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Copy)]
pub enum Destination {
    Config,
    Plugin,
    Bin,
}

#[derive(Debug, Clone, Copy)]
pub struct Asset {
    pub name: &'static str,
    pub contents: &'static str,
    pub mode: u32,
    pub destination: Destination,
}
