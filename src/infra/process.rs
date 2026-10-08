use crate::error::{Error, Result};
use std::process::{Command, Stdio};

pub fn available(program: &str) -> bool {
    Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {program}"))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub fn run(program: &str, args: &[&str]) -> Result<()> {
    run_in(program, args, None)
}

pub fn run_in(program: &str, args: &[&str], dir: Option<&std::path::Path>) -> Result<()> {
    let mut command = Command::new(program);
    command.args(args);
    if let Some(dir) = dir {
        command.current_dir(dir);
    }
    let status = command
        .status()
        .map_err(|e| Error::io(format!("spawn {program}"), e))?;
    if status.success() {
        return Ok(());
    }
    Err(Error::Command {
        program: program.to_string(),
        code: status.code(),
    })
}
