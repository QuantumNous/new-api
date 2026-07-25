// §37 voice input — the composer's side of the contract, driven through a mocked
// __TAURI__ global (the mic is native-only; the browser build renders no mic at all).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Composer } from "./Composer";

const READY = {
  recording: false,
  model_installed: true,
  model_verified: true,
  test_passed: true,
  download_in_progress: false,
  model_name: "Whisper Base English (local)",
  model_bytes: 147964211,
  supported: true,
  device_summary: "macOS 15 · Apple Silicon",
  compatibility_reason: null,
};
const NOT_READY = { ...READY, model_verified: false, test_passed: false };
const RECORDING = { ...READY, recording: true };

let invoke: ReturnType<typeof vi.fn>;

const props = (extra: Partial<Parameters<typeof Composer>[0]> = {}) => ({
  mode: "interactive",
  model: "gpt-5.6-sol",
  running: false,
  connected: true,
  onSend: vi.fn(),
  onInterrupt: vi.fn(),
  onModeChange: vi.fn(),
  onModelChange: vi.fn(),
  ...extra,
});

beforeEach(() => {
  invoke = vi.fn(async (cmd: string) => {
    if (cmd === "get_dictation_status") return READY;
    if (cmd === "start_dictation") return RECORDING;
    if (cmd === "stop_dictation") return "hello from the mic";
    return null;
  });
  (globalThis as any).__TAURI__ = { core: { invoke }, event: { listen: async () => () => {} } };
});

afterEach(() => {
  cleanup();
  delete (globalThis as any).__TAURI__;
});

describe("Composer voice input (§37)", () => {
  it("renders no mic at all outside the desktop app", () => {
    delete (globalThis as any).__TAURI__;
    render(<Composer {...props()} />);
    expect(screen.queryByLabelText(/dictation|Voice Input/)).toBeNull();
  });

  it("not ready → muted mic deep-links to Settings instead of recording", async () => {
    invoke.mockImplementation(async (cmd: string) =>
      cmd === "get_dictation_status" ? NOT_READY : null,
    );
    const onConfigureVoiceInput = vi.fn();
    render(<Composer {...props({ onConfigureVoiceInput })} />);

    const mic = await screen.findByLabelText("Configure Voice Input in Settings");
    expect(mic.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(mic);
    await waitFor(() => expect(onConfigureVoiceInput).toHaveBeenCalled());
    expect(invoke).not.toHaveBeenCalledWith("start_dictation", undefined);
  });

  it("ready → record shows the waveform and protects Send; stop inserts an editable draft", async () => {
    render(<Composer {...props()} />);

    fireEvent.click(await screen.findByLabelText("Start dictation"));
    const stop = await screen.findByLabelText("Stop dictation");
    expect(document.querySelector(".voice-wave-bars")).toBeTruthy();
    expect(screen.getByLabelText("Send").hasAttribute("disabled")).toBe(true);

    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "stop_dictation") return "hello from the mic";
      if (cmd === "get_dictation_status") return READY;
      return null;
    });
    fireEvent.click(stop);
    await screen.findByLabelText("Start dictation"); // recording UI wound down
    const box = screen.getByPlaceholderText(/Ask the coworker/) as HTMLTextAreaElement;
    expect(box.value).toBe("hello from the mic"); // a DRAFT — nothing auto-sent
    expect(document.querySelector(".voice-wave-bars")).toBeNull();
  });

  it("a start failure surfaces the error and never wedges the mic", async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_dictation_status") return READY;
      if (cmd === "start_dictation") throw new Error("No microphone is available.");
      return null;
    });
    render(<Composer {...props()} />);

    fireEvent.click(await screen.findByLabelText("Start dictation"));
    expect((await screen.findByRole("alert")).textContent).toContain("No microphone is available.");
    expect(screen.getByLabelText("Start dictation").hasAttribute("disabled")).toBe(false);
  });
});
