// interval-ping TUI: live "next ping in X" countdown in the prompt footer.
//
// This entrypoint only reads the schedule over RPC (rpc.js) and renders it.
// It does not own the timer or the /ping command — those live in index.js.

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

function Countdown(props) {
  const context = props.context;
  const rpc = context.client.rpc(IntervalPing);

  const [active, setActive] = createSignal(false);
  const [nextAt, setNextAt] = createSignal(0);
  const [now, setNow] = createSignal(Date.now());

  const refresh = async (sessionID) => {
    if (!sessionID) {
      setActive(false);
      return;
    }
    try {
      const result = await rpc.status({ sessionID: sessionID });
      setActive(result.active);
      setNextAt(result.nextAt);
    } catch {
      setActive(false);
    }
  };

  // Refresh whenever the displayed session changes.
  createEffect(() => {
    const sessionID = props.sessionID;
    void refresh(sessionID);
    if (!sessionID) {
      return;
    }
    const unsubscribe = rpc.events.on("changed", (event) => {
      if (!event || !event.data || event.data.sessionID === sessionID) {
        void refresh(sessionID);
      }
    });
    onCleanup(unsubscribe);
  });

  // Tick locally so the countdown updates every second.
  const ticker = setInterval(() => {
    setNow(Date.now());
    const remaining = nextAt() - Date.now();
    if (active() && remaining <= 0) {
      void refresh(props.sessionID);
    }
  }, 1000);
  onCleanup(() => clearInterval(ticker));

  const label = () => {
    const remaining = nextAt() - now();
    return "⏰ " + formatRemaining(remaining);
  };

  return (
    <Show when={active()}>
      <text fg={context.theme.text.muted}>{label()}</text>
    </Show>
  );
}

export default Plugin.define({
  id: "interval-ping.tui",
  setup(context) {
    return context.ui.slot({
      append: "prompt.footer.status",
      render: (input) => (
        <Countdown context={context} sessionID={input.sessionID} />
      ),
    });
  },
});
