use crate::domain::models::{Asset, Destination};

pub const TEMPLATE: &str = include_str!("../../config/opencode.json.tmpl");

const CLI_JSON: &str = include_str!("../../config/cli.json");
const TUI_JSON: &str = include_str!("../../config/tui.json");
const PACKAGE_JSON: &str = include_str!("../../config/package.json");
const PLUGIN_JS: &str = include_str!("../../plugins/karakuri/plugin.js");
const PLUGIN_PACKAGE_JSON: &str = include_str!("../../plugins/karakuri/package.json");
const WRAPPER: &str = include_str!("../../bin/opencode2");

pub const ASSETS: &[Asset] = &[
    Asset {
        name: "cli.json",
        contents: CLI_JSON,
        mode: 0o644,
        destination: Destination::Config,
    },
    Asset {
        name: "tui.json",
        contents: TUI_JSON,
        mode: 0o644,
        destination: Destination::Config,
    },
    Asset {
        name: "package.json",
        contents: PACKAGE_JSON,
        mode: 0o644,
        destination: Destination::Config,
    },
    Asset {
        name: "plugin.js",
        contents: PLUGIN_JS,
        mode: 0o644,
        destination: Destination::Plugin,
    },
    Asset {
        name: "package.json",
        contents: PLUGIN_PACKAGE_JSON,
        mode: 0o644,
        destination: Destination::Plugin,
    },
    Asset {
        name: "opencode2",
        contents: WRAPPER,
        mode: 0o755,
        destination: Destination::Bin,
    },
];
