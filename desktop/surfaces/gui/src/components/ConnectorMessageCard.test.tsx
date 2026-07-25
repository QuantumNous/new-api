import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConnectorMessageCard } from "./ConnectorMessageCard";
import { itemsFromMessages } from "../itemsFromMessages";
import type { MessageSource } from "../api";

const SOURCE: MessageSource = {
  connector: "slack",
  kind: "channel",
  channel_id: "C0BD7KZ1AH5",
  channel_name: "#ocw-test",
  sender_id: "U07JK68S4BH",
  sender_name: "Jordan Lee",
  ts: 1719700000,
  text: "Hey team — did the staging deploy go out?",
};

afterEach(cleanup);

describe("ConnectorMessageCard", () => {
  it("renders the channel name, sender name and the body for a source", () => {
    render(<ConnectorMessageCard source={SOURCE} />);
    expect(screen.getByText("#ocw-test")).toBeTruthy();
    expect(screen.getByText("Jordan Lee")).toBeTruthy();
    expect(screen.getByText(/staging deploy go out/)).toBeTruthy();
    expect(screen.getByText("via Slack")).toBeTruthy();
    // ids are not shown until hover.
    expect(screen.queryByText(/C0BD7KZ1AH5/)).toBeNull();
  });

  it("renders the connector badge (registry SVG) brand-tagged by the connector id", () => {
    const { container } = render(<ConnectorMessageCard source={SOURCE} />);
    expect(container.querySelector(".connector-badge svg")).not.toBeNull();
    expect(container.querySelector(".connector-card[data-brand='slack']")).not.toBeNull();
  });

  it("falls back to the plug glyph + neutral brand for an unknown connector id", () => {
    const { container } = render(
      <ConnectorMessageCard source={{ ...SOURCE, connector: "does-not-exist" }} />,
    );
    expect(container.querySelector(".connector-card[data-brand='fallback']")).not.toBeNull();
    expect(container.querySelector(".connector-badge svg")).not.toBeNull();
  });

  it("swaps names → `channel_id · sender_id` on hover, and back on leave", () => {
    const { container } = render(<ConnectorMessageCard source={SOURCE} />);
    const head = container.querySelector(".connector-card-head") as HTMLElement;

    fireEvent.mouseEnter(head);
    expect(screen.getByText(/C0BD7KZ1AH5/)).toBeTruthy();
    expect(screen.getByText(/U07JK68S4BH/)).toBeTruthy();
    // the resolved names are hidden while the ids are shown.
    expect(screen.queryByText("Jordan Lee")).toBeNull();
    expect(screen.queryByText("#ocw-test")).toBeNull();

    fireEvent.mouseLeave(head);
    expect(screen.getByText("Jordan Lee")).toBeTruthy();
    expect(screen.queryByText(/C0BD7KZ1AH5/)).toBeNull();
  });

  it("also reveals ids on keyboard focus (accessibility parity with hover)", () => {
    const { container } = render(<ConnectorMessageCard source={SOURCE} />);
    const head = container.querySelector(".connector-card-head") as HTMLElement;
    fireEvent.focus(head);
    expect(screen.getByText(/C0BD7KZ1AH5/)).toBeTruthy();
  });
});

describe("itemsFromMessages", () => {
  it("maps a user message carrying source.connector to a `connector` item", () => {
    const items = itemsFromMessages([
      { role: "user", content: "💬 New message on slack:#ocw-test …", source: SOURCE },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("connector");
    expect((items[0] as Extract<(typeof items)[number], { kind: "connector" }>).source.channel_name).toBe(
      "#ocw-test",
    );
  });

  it("maps a plain user message (no source) to a `user` bubble", () => {
    const items = itemsFromMessages([{ role: "user", content: "hello there" }]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("user");
  });
});
