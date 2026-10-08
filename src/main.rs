mod cli;
mod domain;
mod error;
mod infra;

use std::process::ExitCode;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("\u{2718} {err}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> error::Result<()> {
    let args = cli::args::parse(std::env::args().skip(1))?;
    match args.command {
        cli::args::Command::Install => infra::install::run(),
        cli::args::Command::Version => {
            println!("opencode-config {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        cli::args::Command::Help => {
            cli::help::print();
            Ok(())
        }
    }
}
