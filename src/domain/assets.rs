use crate::domain::models::{Asset, Destination};

pub const TEMPLATE: &str = include_str!("../../config/opencode.json.tmpl");

const CLI_JSON: &str = include_str!("../../config/cli.json");
const TUI_JSON: &str = include_str!("../../config/tui.json");
const PACKAGE_JSON: &str = include_str!("../../config/package.json");
const PLUGIN_JS: &str = include_str!("../../plugins/karakuri/plugin.js");
const PLUGIN_PACKAGE_JSON: &str = include_str!("../../plugins/karakuri/package.json");
const INTERVAL_PING_INDEX: &str = include_str!("../../plugins/interval-ping/index.js");
const INTERVAL_PING_RPC: &str = include_str!("../../plugins/interval-ping/rpc.js");
const INTERVAL_PING_TUI: &str = include_str!("../../plugins/interval-ping/tui.tsx");
const INTERVAL_PING_PACKAGE_JSON: &str = include_str!("../../plugins/interval-ping/package.json");
const BACKGROUND_TASKS_INDEX: &str = include_str!("../../plugins/background-tasks/index.js");
const BACKGROUND_TASKS_TUI: &str = include_str!("../../plugins/background-tasks/tui.tsx");
const BACKGROUND_TASKS_PACKAGE_JSON: &str =
    include_str!("../../plugins/background-tasks/package.json");
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
        name: "index.js",
        contents: INTERVAL_PING_INDEX,
        mode: 0o644,
        destination: Destination::IntervalPing,
    },
    Asset {
        name: "rpc.js",
        contents: INTERVAL_PING_RPC,
        mode: 0o644,
        destination: Destination::IntervalPing,
    },
    Asset {
        name: "tui.tsx",
        contents: INTERVAL_PING_TUI,
        mode: 0o644,
        destination: Destination::IntervalPing,
    },
    Asset {
        name: "package.json",
        contents: INTERVAL_PING_PACKAGE_JSON,
        mode: 0o644,
        destination: Destination::IntervalPing,
    },
    Asset {
        name: "index.js",
        contents: BACKGROUND_TASKS_INDEX,
        mode: 0o644,
        destination: Destination::BackgroundTasks,
    },
    Asset {
        name: "tui.tsx",
        contents: BACKGROUND_TASKS_TUI,
        mode: 0o644,
        destination: Destination::BackgroundTasks,
    },
    Asset {
        name: "package.json",
        contents: BACKGROUND_TASKS_PACKAGE_JSON,
        mode: 0o644,
        destination: Destination::BackgroundTasks,
    },
    Asset {
        name: "opencode2",
        contents: WRAPPER,
        mode: 0o755,
        destination: Destination::Bin,
    },
];
