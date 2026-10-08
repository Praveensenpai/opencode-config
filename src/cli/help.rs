const HELP: &str = "\
opencode-config — install a customized OpenCode setup

USAGE:
    opencode-config [COMMAND]

COMMANDS:
    install     Restore config, plugin, and wrapper (default)
    version     Print the version
    help        Show this message

OPTIONS:
    -h, --help       Show this message
    -V, --version    Print the version

ENVIRONMENT:
    MOCHI_BASE_URL          Provider base URL (default http://mochi:4000/v1)
    MOCHI_API_KEY           Provider API key (prompts if unset)
    SKIP_KARAKURI=1         Skip the karakuri rules/skills bootstrap
";

pub fn print() {
    print!("{HELP}");
}
