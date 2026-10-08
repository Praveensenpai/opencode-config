use crate::error::{Error, Result};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

pub fn create_dir(path: &Path) -> Result<()> {
    fs::create_dir_all(path).map_err(|e| Error::io(format!("create {}", path.display()), e))
}

pub fn write_file(path: &Path, contents: &str, mode: u32) -> Result<()> {
    if let Some(parent) = path.parent() {
        create_dir(parent)?;
    }
    fs::write(path, contents).map_err(|e| Error::io(format!("write {}", path.display()), e))?;
    set_mode(path, mode)
}

pub fn set_mode(path: &Path, mode: u32) -> Result<()> {
    let perms = fs::Permissions::from_mode(mode);
    fs::set_permissions(path, perms).map_err(|e| Error::io(format!("chmod {}", path.display()), e))
}
