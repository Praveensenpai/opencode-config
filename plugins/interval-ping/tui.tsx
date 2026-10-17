// interval-ping TUI: live "next ping in X" countdown in the prompt footer,
// plus a compact status block in the right sidebar.
//
// This entrypoint only reads the schedule over RPC (rpc.js) and renders it.
// It does not own the timer or the /ping command - those live in index.js.

import { Plugin } from "@opencode/plugin/tui";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { IntervalPing } from "./rpc.js";

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const padded = seconds < 10 ? "0" + seconds : String(seconds);
  return minutes + ":" + padded;
}

function useSchedule(rpc, sessionID) {
  const [active, setActive] = createSignal(false);
  const [nextAt, setNextAt] = createSignal(0);
  const [minutes, setMinutes] = createSignal(0);
  const [now, setNow] = createSignal(Date.now());

  const refresh = async (id) => {
    if (!id) {
      setActive(false);
      return;
    }
    try {
      const result = await rpc.status({ sessionID: id });
      setActive(result.active);
      setNextAt(result.nextAt);
      setMinutes(result.minutes);
    } catch {
      setActive(false);
    }
  };
  // Refresh whenever the displayed session changes.
  createEffect(() => {
    const id = sessionID();
    void refresh(id);
    if (!id) {
      return;
    }
    const unsubscribe = rpc.events.on("changed", (event) => {
      if (!event || !event.data || event.data.sessionID === id) {
        void refresh(id);
      }
    });
    onCleanup(unsubscribe);
  });

  // Tick locally so the countdown updates every second. While inactive we
  // also re-poll the server every 5s: the `changed` event is best-effort, and
  // if it is missed (or a timer starts after this component mounted) the view
  // would otherwise sit on a stale `idle` forever. Polling only happens when
  // inactive, so an active timer costs no extra requests.
  let sincePoll = 0;
  const ticker = setInterval(() => {
    setNow(Date.now());
    if (active() && nextAt() - Date.now() <= 0) {
      void refresh(sessionID());
      return;
    }
    if (!active()) {
      sincePoll += 1;
      if (sincePoll >= 5) {
        sincePoll = 0;
        void refresh(sessionID());
      }
    }
  }, 1000);
  onCleanup(() => clearInterval(ticker));

  return { active, nextAt, minutes, now };
}

function Countdown(props) {
  const context = props.context;
  const rpc = context.client.rpc(IntervalPing);
  const schedule = useSchedule(rpc, () => props.sessionID);

  const label = () => {
    const remaining = schedule.nextAt() - schedule.now();
    return "\u25f7 " + formatRemaining(remaining);
  };

  return (
    <Show when={schedule.active()}>
      <text fg={context.theme.text.muted} attributes={1}>
        {label()}
      </text>
    </Show>
  );
}

// Terminals are a fixed cell grid, so there is no font-size prop to double.
// A glyph can only read as "larger" by occupying more cells: the sidebar mark
// is a 3x3 box-drawn clock, while the footer keeps the single inline glyph.
function ClockMark(props) {
  const context = props.context;
  const fg = () =>
    props.active ? context.theme.text.base : context.theme.text.muted;

  return (
    <box flexDirection="column" marginRight={1}>
      <text fg={fg()}>{"\u256d\u2500\u256e"}</text>
      <text fg={fg()}>{"\u2502\u25f7\u2502"}</text>
      <text fg={fg()}>{"\u2570\u2500\u256f"}</text>
    </box>
  );
}

function PingStatus(props) {
  const context = props.context;
  const rpc = context.client.rpc(IntervalPing);
  const schedule = useSchedule(rpc, () => props.sessionID);

  const value = () =>
    schedule.active()
      ? "next " + formatRemaining(schedule.nextAt() - schedule.now())
      : "idle";
  const detail = () =>
    schedule.active()
      ? "every " + schedule.minutes() + " min \u00b7 /ping stop"
      : "/ping 5 to start";

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1} marginTop={1}>
      <box flexDirection="row">
        <ClockMark context={context} active={schedule.active()} />
        <box flexDirection="column" flexGrow={1}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={context.theme.text.base} attributes={1}>
              <strong>Ping</strong>
            </text>
            <text
              fg={
                schedule.active()
                  ? context.theme.text.base
                  : context.theme.text.muted
              }
            >
              {value()}
            </text>
          </box>
          <text fg={context.theme.text.muted}>{detail()}</text>
        </box>
      </box>
    </box>
  );
}

export default Plugin.define({
  id: "interval-ping.tui",
  setup(context) {
    const stopFooter = context.ui.slot({
      append: "prompt.footer.status",
      render: (input) => (
        <Countdown context={context} sessionID={input.sessionID} />
      ),
    });
    const stopSidebar = context.ui.slot({
      append: "sidebar.content",
      render: (input) => (
        <PingStatus context={context} sessionID={input.sessionID} />
      ),
    });
    return function () {
      stopSidebar();
      stopFooter();
    };
  },
});
