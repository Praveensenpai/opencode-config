use crate::domain::assets;
use crate::domain::models::{Destination, Paths};
use crate::domain::render;
use crate::error::Result;
use crate::infra::{env, fs, karakuri, log, process};
use std::path::{Path, PathBuf};

pub fn run() -> Result<()> {
    log::info("opencode-config installer");
    let paths = env::paths();
    let secrets = env::secrets()?;

    install_config(&paths, &secrets)?;
    install_assets(&paths)?;
    install_plugin_deps(&paths);
    karakuri::bootstrap();

    log::ok("Done. Restart OpenCode to load the new configuration.");
    if secrets.api_key == "CHANGE_ME" {
        log::warn("Mochi API key left as placeholder");
    }
    Ok(())
}

fn install_config(paths: &Paths, secrets: &crate::domain::models::Secrets) -> Result<()> {
    let rendered = render::render_template(assets::TEMPLATE, secrets);
    let target = paths.config_dir.join("opencode.json");
    log::info(&format!("Rendering opencode.json → {}", target.display()));
    fs::write_file(&target, &rendered, 0o600)
}

fn install_assets(paths: &Paths) -> Result<()> {
    for asset in assets::ASSETS {
        let target = destination_path(paths, asset.destination).join(asset.name);
        fs::write_file(&target, asset.contents, asset.mode)?;
        log::ok(&format!("Installed {}", target.display()));
    }
    Ok(())
}

fn destination_path(paths: &Paths, destination: Destination) -> PathBuf {
    match destination {
        Destination::Config => paths.config_dir.clone(),
        Destination::Plugin => paths.config_dir.join("plugins").join("karakuri"),
        Destination::Bin => paths.bin_dir.clone(),
    }
}

fn install_plugin_deps(paths: &Paths) {
    if !paths.config_dir.join("package.json").exists() {
        return;
    }
    if process::available("bun") {
        run_dep_install("bun", &paths.config_dir);
    } else if process::available("npm") {
        run_dep_install("npm", &paths.config_dir);
    } else {
        log::warn("Neither bun nor npm found; skipping plugin dependency install");
    }
}

fn run_dep_install(program: &str, dir: &Path) {
    let result = process::run_in(program, &["install", "--silent"], Some(dir));
    match result {
        Ok(()) => log::ok(&format!("Installed plugin deps ({program})")),
        Err(_) => log::warn(&format!("{program} dependency install failed")),
    }
}
