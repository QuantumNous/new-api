import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GatewayAccountProvider,
  useGatewayAccount,
  useGatewayAccountState,
} from "./useGatewayAccount";

/**
 * Nothing in BoxAI Connect works without an account.
 *
 * The provider, BoxAI MCP servers and official skills are all seeded from
 * a connected account and withdrawn on sign-out, so a
 * signed-out window has no working configuration to offer. Showing the app shell
 * anyway is what produced the earlier failure mode: a fully rendered client that
 * answered every request with an error.
 */
export function BoxAISignInGate({ children }: { children: ReactNode }) {
  const account = useGatewayAccountState();
  return (
    <GatewayAccountProvider value={account}>
      {account.loading ? (
        <SignInSplash />
      ) : account.status?.connected ? (
        children
      ) : (
        <SignInScreen />
      )}
    </GatewayAccountProvider>
  );
}

function SignInSplash() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      data-testid="boxai-signin-loading"
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function SignInScreen() {
  const { t } = useTranslation();
  const { pending, error, signIn } = useGatewayAccount();

  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-6 px-8"
      data-testid="boxai-signin"
    >
      <div className="max-w-sm space-y-2 text-center">
        <h1 className="text-xl font-semibold">
          {t("boxai.account.title", { defaultValue: "BoxAI 账号" })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("boxai.account.gateDescription", {
            defaultValue:
              "BoxAI Connect 需要登录后使用。登录在浏览器中确认，账号状态保存在本机配置目录。",
          })}
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <Button
          className="w-full"
          onClick={() => void signIn()}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          {pending
            ? t("boxai.account.waiting", { defaultValue: "等待确认…" })
            : t("boxai.account.signIn", {
                defaultValue: "登录 BoxAI",
              })}
        </Button>
        {pending && (
          <p className="text-center text-xs text-muted-foreground">
            {t("boxai.account.browserOpened", {
              defaultValue: "已在浏览器中打开授权页面，完成后会自动返回。",
            })}
          </p>
        )}
        {error && (
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
