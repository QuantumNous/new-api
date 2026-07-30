import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useUpdate } from "@/contexts/UpdateContext";
import { settingsApi } from "@/lib/api";

interface UpdateSettingsProps {
  isPortable: boolean;
}

export function UpdateSettings({ isPortable }: UpdateSettingsProps) {
  const { t } = useTranslation();
  const { hasUpdate, updateInfo, isChecking, error, checkUpdate } = useUpdate();
  const [isInstalling, setIsInstalling] = useState(false);
  const [checkedUpToDate, setCheckedUpToDate] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const handleCheck = async () => {
    setCheckedUpToDate(false);
    setInstallError(null);
    try {
      const available = await checkUpdate();
      setCheckedUpToDate(!available);
    } catch {
      // UpdateContext exposes the localized failure state next to this action.
    }
  };

  const handleInstall = async () => {
    setInstallError(null);
    setIsInstalling(true);
    try {
      const started = await settingsApi.installUpdateAndRestart();
      if (!started) {
        setCheckedUpToDate(true);
        await checkUpdate();
      }
    } catch (installFailure) {
      setInstallError(
        installFailure instanceof Error
          ? installFailure.message
          : t("settings.updateFailed"),
      );
    } finally {
      setIsInstalling(false);
    }
  };

  const status = isPortable
    ? t("settings.portableMode")
    : hasUpdate && updateInfo
      ? t("settings.updateAvailable", {
          version: updateInfo.availableVersion,
        })
      : checkedUpToDate
        ? t("settings.upToDate")
        : t("settings.aboutHint");

  return (
    <section className="space-y-2">
      <header className="space-y-1">
        <h3 className="text-sm font-medium text-balance">
          {t("settings.checkForUpdates")}
        </h3>
        <p className="text-xs text-muted-foreground text-pretty">{status}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {hasUpdate && updateInfo && !isPortable ? (
          <Button
            type="button"
            size="sm"
            disabled={isInstalling}
            onClick={() => void handleInstall()}
          >
            {isInstalling ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {isInstalling
              ? t("settings.updating")
              : t("settings.updateTo", {
                  version: updateInfo.availableVersion,
                })}
          </Button>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isChecking || isInstalling}
          onClick={() => void handleCheck()}
        >
          {isChecking ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          {isChecking ? t("settings.checking") : t("settings.checkForUpdates")}
        </Button>
      </div>

      {error || installError ? (
        <p className="text-xs text-destructive text-pretty" role="alert">
          {installError || t("settings.checkUpdateFailed")}
        </p>
      ) : null}
    </section>
  );
}
