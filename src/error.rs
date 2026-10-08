use std::fmt;
use std::io;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug)]
pub enum Error {
    Io { context: String, source: io::Error },
    Invalid(String),
    Command { program: String, code: Option<i32> },
}

impl Error {
    pub fn io(context: impl Into<String>, source: io::Error) -> Self {
        Error::Io {
            context: context.into(),
            source,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io { context, source } => write!(f, "{context}: {source}"),
            Error::Invalid(message) => write!(f, "{message}"),
            Error::Command { program, code } => match code {
                Some(code) => write!(f, "`{program}` failed with exit code {code}"),
                None => write!(f, "`{program}` terminated by signal"),
            },
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Io { source, .. } => Some(source),
            Error::Invalid(_) | Error::Command { .. } => None,
        }
    }
}
