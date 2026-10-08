use crate::error::{Error, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Command {
    Install,
    Version,
    Help,
}

#[derive(Debug, Clone, Copy)]
pub struct Args {
    pub command: Command,
}

const HELP_FLAGS: [&str; 2] = ["-h", "--help"];
const VERSION_FLAGS: [&str; 2] = ["-V", "--version"];

pub fn parse<I>(raw: I) -> Result<Args>
where
    I: Iterator<Item = String>,
{
    let mut command = Command::Install;
    for arg in raw {
        command = match arg.as_str() {
            "install" => Command::Install,
            "version" => Command::Version,
            "help" => Command::Help,
            flag if HELP_FLAGS.contains(&flag) => Command::Help,
            flag if VERSION_FLAGS.contains(&flag) => Command::Version,
            other => return Err(Error::Invalid(format!("unknown argument: {other}"))),
        };
    }
    Ok(Args { command })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_strs(items: &[&str]) -> Result<Args> {
        parse(items.iter().map(|s| (*s).to_string()))
    }

    #[test]
    fn defaults_to_install() {
        assert_eq!(
            parse_strs(&[]).map(|a| a.command).ok(),
            Some(Command::Install)
        );
    }

    #[test]
    fn recognizes_help_flag() {
        assert_eq!(
            parse_strs(&["--help"]).map(|a| a.command).ok(),
            Some(Command::Help)
        );
    }

    #[test]
    fn rejects_unknown() {
        assert!(parse_strs(&["--nope"]).is_err());
    }
}
