import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import { BoxAISignInGate } from "@/components/boxai/BoxAISignInGate";
import { server } from "../msw/server";
import { connectedGatewayStatus } from "../msw/handlers";

const TAURI_ENDPOINT = "http://tauri.local";

const disconnected = (message: string | null = null) => ({
  connected: false,
  account: null,
  portalHost: "https://you-box.com",
  aiHost: "https://you-box.com",
  message,
});

const signedOut = () =>
  server.use(
    http.post(`${TAURI_ENDPOINT}/gateway_auth_status`, () =>
      HttpResponse.json(disconnected()),
    ),
  );

const renderGate = () =>
  render(
    <BoxAISignInGate>
      <div data-testid="app-shell">app</div>
    </BoxAISignInGate>,
  );

describe("BoxAISignInGate", () => {
  it("keeps the app shell out of reach until an account is connected", async () => {
    signedOut();
    renderGate();

    await screen.findByTestId("boxai-signin");
    expect(screen.queryByTestId("app-shell")).toBeNull();
  });

  it("renders the app once a stored credential is found", async () => {
    renderGate();

    await screen.findByTestId("app-shell");
    expect(screen.queryByTestId("boxai-signin")).toBeNull();
  });

  it("hands the browser sign-in to the backend and opens the app on success", async () => {
    signedOut();
    let loginCalls = 0;
    server.use(
      http.post(`${TAURI_ENDPOINT}/gateway_browser_login`, () => {
        loginCalls += 1;
        return HttpResponse.json(connectedGatewayStatus());
      }),
    );
    renderGate();

    await screen.findByTestId("boxai-signin");
    await userEvent.click(screen.getByRole("button"));

    await screen.findByTestId("app-shell");
    expect(loginCalls).toBe(1);
  });

  it("shows why a sign-in did not complete and stays on the gate", async () => {
    signedOut();
    server.use(
      http.post(`${TAURI_ENDPOINT}/gateway_browser_login`, () =>
        HttpResponse.json(disconnected("Sign-in was declined")),
      ),
    );
    renderGate();

    await screen.findByTestId("boxai-signin");
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Sign-in was declined",
      ),
    );
    expect(screen.queryByTestId("app-shell")).toBeNull();
  });
});
