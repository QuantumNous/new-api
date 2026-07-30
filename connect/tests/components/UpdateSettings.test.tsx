import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateSettings } from "@/components/settings/UpdateSettings";

const { checkUpdate, installUpdateAndRestart, updateState } = vi.hoisted(
  () => ({
    checkUpdate: vi.fn(),
    installUpdateAndRestart: vi.fn(),
    updateState: {
      hasUpdate: false,
      updateInfo: null as {
        currentVersion: string;
        availableVersion: string;
      } | null,
      isChecking: false,
      error: null as string | null,
    },
  }),
);

vi.mock("@/contexts/UpdateContext", () => ({
  useUpdate: () => ({ ...updateState, checkUpdate }),
}));

vi.mock("@/lib/api", () => ({
  settingsApi: { installUpdateAndRestart },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { version?: string }) =>
      values?.version ? `${key}:${values.version}` : key,
  }),
}));

describe("UpdateSettings", () => {
  beforeEach(() => {
    updateState.hasUpdate = false;
    updateState.updateInfo = null;
    updateState.isChecking = false;
    updateState.error = null;
    checkUpdate.mockReset();
    installUpdateAndRestart.mockReset();
  });

  it("checks the updater feed and reports that the installed version is current", async () => {
    checkUpdate.mockResolvedValue(false);
    render(<UpdateSettings isPortable={false} />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings.checkForUpdates" }),
    );

    await waitFor(() => expect(checkUpdate).toHaveBeenCalledOnce());
    expect(screen.getByText("settings.upToDate")).toBeInTheDocument();
  });

  it("installs an available update through the app updater", async () => {
    updateState.hasUpdate = true;
    updateState.updateInfo = {
      currentVersion: "0.1.4",
      availableVersion: "0.1.5",
    };
    installUpdateAndRestart.mockResolvedValue(true);
    render(<UpdateSettings isPortable={false} />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings.updateTo:0.1.5" }),
    );

    await waitFor(() => expect(installUpdateAndRestart).toHaveBeenCalledOnce());
  });

  it("does not offer in-place installation in portable mode", () => {
    updateState.hasUpdate = true;
    updateState.updateInfo = {
      currentVersion: "0.1.4",
      availableVersion: "0.1.5",
    };
    render(<UpdateSettings isPortable />);

    expect(screen.getByText("settings.portableMode")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "settings.updateTo:0.1.5" }),
    ).not.toBeInTheDocument();
  });
});
