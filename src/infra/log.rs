const RESET: &str = "\u{1b}[0m";
const MAGENTA: &str = "\u{1b}[1;35m";
const GREEN: &str = "\u{1b}[1;32m";
const YELLOW: &str = "\u{1b}[1;33m";

pub fn info(message: &str) {
    eprintln!("{MAGENTA}\u{1f338}{RESET} {message}");
}

pub fn ok(message: &str) {
    eprintln!("{GREEN}\u{2714}{RESET} {message}");
}

pub fn warn(message: &str) {
    eprintln!("{YELLOW}\u{26a0}{RESET} {message}");
}
