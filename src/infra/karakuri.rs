use crate::infra::{env, log, process};

const KARAKURI_INSTALL_URL: &str =
    "https://raw.githubusercontent.com/Praveensenpai/karakuri/main/install.sh";

pub fn bootstrap() {
    if env::skip_karakuri() {
        log::warn("Skipping karakuri bootstrap (SKIP_KARAKURI=1)");
        return;
    }
    if process::available("karakuri") {
        log::info("karakuri present; syncing skills across agents...");
        if process::run("karakuri", &["sync"]).is_err() {
            log::warn("karakuri sync failed");
        }
        return;
    }
    install_remote();
}

fn install_remote() {
    if !process::available("curl") {
        log::warn("curl not found; skipping karakuri bootstrap");
        return;
    }
    log::info("Bootstrapping karakuri (rules + skills)...");
    let script =
        format!("curl -fsSL {KARAKURI_INSTALL_URL} | bash -s -- install --global --all -y");
    if process::run("sh", &["-c", &script]).is_err() {
        log::warn("karakuri bootstrap failed");
    }
}
