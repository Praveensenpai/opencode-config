// background-tasks TUI: a compact right-sidebar panel that shows everything
// still running in this session, newest first, with a live elapsed clock.
//
// Three sources are merged:
//   - background shells  (data.shell.list)
//   - detached subagents (data.session.list, sessions with a parentID)
//   - PTY processes      (client.pty.list)
//
// Each row: bold command, faded truncated log tail, right-aligned elapsed.
// Click a row (or press e) to enlarge it ~30%: it grows to show more log
// lines and pushes the rows below it down. Press r to reverse the order.
// Keys: j/k move, enter jumps to the owning session, o opens the full panel.

import { Plugin } from "@opencode/plugin/tui";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";

const SHELL = "shell";
const PTY = "pty";
const SUBAGENT = "subagent";

const ICON = { shell: "$", pty: ">", subagent: "✳" };
const DEFAULT_WIDTH = 40;
const COMPACT_LINES = 1;
const EXPANDED_LINES = 5;

function elapsed(started) {
  if (!started) {
    return "";
  }
  const total = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes + ":" + (seconds < 10 ? "0" + seconds : String(seconds));
}

function flatten(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function truncate(value, max) {
  const flat = flatten(value);
  if (flat.length <= max) {
    return flat;
  }
  return max <= 1 ? flat.slice(0, 1) : flat.slice(0, max - 1) + "…";
}

function tailLines(text, count) {
  const lines = String(text == null ? "" : text)
    .split(/\r?\n/)
    .filter(function (line) {
      return line.trim().length > 0;
    });
  return lines.slice(-count);
}

function rowsFromShells(shells, logFor) {
  const out = [];
  for (let index = 0; index < shells.length; index += 1) {
    const shell = shells[index];
    out.push({
      key: SHELL + ":" + shell.id,
      kind: SHELL,
      id: shell.id,
      sessionID: shell.metadata && shell.metadata.sessionID,
      command: shell.command,
      started: shell.time && shell.time.started,
      text: logFor(shell.id),
    });
  }
  return out;
}

function rowsFromSessions(sessions, statusOf) {
  const out = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (!session.parentID || statusOf(session.id) !== "running") {
      continue;
    }
    out.push({
      key: SUBAGENT + ":" + session.id,
      kind: SUBAGENT,
      id: session.id,
      sessionID: session.id,
      command: session.title || session.agent || "subagent",
      started: session.time && session.time.created,
      text: session.agent ? "agent " + session.agent : "",
    });
  }
  return out;
}

function rowsFromPtys(ptys, startFor) {
  const out = [];
  for (let index = 0; index < ptys.length; index += 1) {
    const pty = ptys[index];
    if (pty.status !== "running") {
      continue;
    }
    out.push({
      key: PTY + ":" + pty.id,
      kind: PTY,
      id: pty.id,
      sessionID: undefined,
      command: pty.title || pty.command,
      started: startFor(pty.id),
      text: flatten(pty.command) + " " + (pty.args || []).join(" "),
    });
  }
  return out;
}

function Row(props) {
  const context = props.context;
  const item = props.item;
  const open = () => props.openKey() === item.key;
  const lines = () => {
    const count = open() ? EXPANDED_LINES : COMPACT_LINES;
    const all = tailLines(item.text, count + 1);
    return all.slice(-count);
  };
  const commandWidth = () => Math.max(6, props.width() - 8);
  const logWidth = () => Math.max(8, props.width() - 4);

  return (
    <box
      flexDirection="column"
      marginTop={1}
      onMouseDown={() => props.onSelect(item.key)}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text
          fg={
            props.selected()
              ? context.theme.text.active
              : context.theme.text.base
          }
          attributes={1}
        >
          {(props.selected() ? "❯ " : "  ") +
            ICON[item.kind] +
            " " +
            truncate(item.command, commandWidth())}
        </text>
        <text fg={context.theme.text.muted}>{elapsed(item.started)}</text>
      </box>
      <Show when={lines().length > 0}>
        <For each={lines()}>
          {(line) => (
            <text fg={context.theme.text.muted}>
              {"  " + truncate(line, logWidth())}
            </text>
          )}
        </For>
      </Show>
    </box>
  );
}

function Panel(props) {
  const context = props.context;
  const width = () => {
    const value = Number(context.options.width);
    return Number.isFinite(value) && value > 8 ? value : DEFAULT_WIDTH;
  };

  const [tick, setTick] = createSignal(0);
  const [cursor, setCursor] = createSignal(0);
  const [openKey, setOpenKey] = createSignal(null);
  const [reversed, setReversed] = createSignal(false);
  const [logs, setLogs] = createSignal({});
  const [ptys, setPtys] = createSignal([]);
  const seenPty = new Map();

  const beat = setInterval(function () {
    setTick(function (value) {
      return value + 1;
    });
  }, 1000);
  onCleanup(function () {
    clearInterval(beat);
  });

  const startFor = function (id) {
    if (!seenPty.has(id)) {
      seenPty.set(id, Date.now());
    }
    return seenPty.get(id);
  };

  const refreshPtys = async function () {
    try {
      const out = await context.client.pty.list();
      const list = (out && out.data) || [];
      for (let index = 0; index < list.length; index += 1) {
        startFor(list[index].id);
      }
      setPtys(list);
    } catch (error) {
      setPtys([]);
    }
  };

  const refreshLogs = async function () {
    const location = context.location;
    const shells = context.data.shell.list(location) || [];
    for (let index = 0; index < shells.length; index += 1) {
      const shell = shells[index];
      try {
        const out = await context.client.shell.output({
          id: shell.id,
          location: location,
          limit: 40,
        });
        const text = out && out.data ? out.data.output : "";
        setLogs(function (current) {
          const next = Object.assign({}, current);
          next[shell.id] = text;
          return next;
        });
      } catch (error) {
        // A shell can vanish between list and output; ignore it.
      }
    }
  };

  const items = createMemo(function () {
    tick();
    const location = context.location;
    const shells = context.data.shell.list(location) || [];
    const sessions = context.data.session.list() || [];
    const statusOf = function (id) {
      return context.data.session.status(id);
    };
    const logFor = function (id) {
      return logs()[id] || "";
    };
    const merged = rowsFromShells(shells, logFor)
      .concat(rowsFromSessions(sessions, statusOf))
      .concat(rowsFromPtys(ptys(), startFor));
    merged.sort(function (a, b) {
      return (b.started || 0) - (a.started || 0);
    });
    return reversed() ? merged.slice().reverse() : merged;
  });

  createEffect(function () {
    void context.data.shell.sync(context.location).catch(function () {});
    void refreshPtys();
    void refreshLogs();
  });

  createEffect(function () {
    const types = [
      "shell.created",
      "shell.exited",
      "shell.deleted",
      "pty.created",
      "pty.updated",
      "pty.exited",
      "pty.deleted",
      "session.status",
      "session.idle",
    ];
    const stops = [];
    for (let index = 0; index < types.length; index += 1) {
      const type = types[index];
      stops.push(
        context.data.on(type, function () {
          if (type.indexOf("shell") === 0) {
            void refreshLogs();
          } else if (type.indexOf("pty") === 0) {
            void refreshPtys();
          } else {
            setTick(function (value) {
              return value + 1;
            });
          }
        }),
      );
    }
    onCleanup(function () {
      for (let index = 0; index < stops.length; index += 1) {
        stops[index]();
      }
    });
  });

  const select = function (key) {
    const list = items();
    for (let index = 0; index < list.length; index += 1) {
      if (list[index].key === key) {
        setCursor(index);
        setOpenKey(openKey() === key ? null : key);
        return;
      }
    }
  };

  const move = function (delta) {
    const list = items();
    if (list.length === 0) {
      return;
    }
    const next = Math.min(Math.max(cursor() + delta, 0), list.length - 1);
    setCursor(next);
    setOpenKey(list[next].key);
  };

  const jump = function () {
    const list = items();
    const item = list[cursor()];
    if (!item || !item.sessionID) {
      return;
    }
    if (!context.ui.tabs.focus(item.sessionID)) {
      context.ui.router.navigate({ type: "session", sessionID: item.sessionID });
    }
  };

  const onKeyDown = function (event) {
    const name = event && (event.name || event.key || event.sequence);
    if (name === "j" || name === "down") {
      move(1);
    } else if (name === "k" || name === "up") {
      move(-1);
    } else if (name === "return" || name === "enter") {
      jump();
    } else if (name === "e") {
      const list = items();
      if (list[cursor()]) {
        const key = list[cursor()].key;
        setOpenKey(openKey() === key ? null : key);
      }
    } else if (name === "r") {
      setReversed(!reversed());
    } else if (name === "o") {
      context.ui.panel.open("background-tasks", { presentation: "panel" });
    } else {
      return;
    }
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
  };

  return (
    <box
      focusable
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      onKeyDown={onKeyDown}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text fg={context.theme.text.base} attributes={1}>
          <strong>Running</strong>
        </text>
        <text
          fg={context.theme.text.muted}
          onMouseDown={() =>
            context.ui.panel.open("background-tasks", {
              presentation: "panel",
            })
          }
        >
          {items().length + "  " + (reversed() ? "oldest" : "newest")}
        </text>
      </box>

      <Show when={items().length === 0}>
        <text fg={context.theme.text.muted}>idle</text>
      </Show>

      <For each={items()}>
        {(item) => (
          <Row
            context={context}
            item={item}
            width={width}
            selected={() => items()[cursor()] && items()[cursor()].key === item.key}
            openKey={openKey}
            onSelect={select}
          />
        )}
      </For>
    </box>
  );
}

function Detail(props) {
  const context = props.context;
  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <text fg={context.theme.text.base} attributes={1}>
        <strong>Background tasks</strong>
      </text>
      <text fg={context.theme.text.muted}>
        j/k move · enter jump · e expand · r reverse
      </text>
    </box>
  );
}

export default Plugin.define({
  id: "background-tasks.tui",
  setup(context) {
    const stopPage = context.ui.router.register({
      name: "background-tasks",
      render: () => <Detail context={context} />,
    });
    const stopSlot = context.ui.slot({
      append: "sidebar.content",
      render: () => <Panel context={context} />,
    });
    return function () {
      stopSlot();
      stopPage();
    };
  },
});
