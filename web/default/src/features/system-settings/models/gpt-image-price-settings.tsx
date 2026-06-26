/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { memo, useCallback, useEffect, useState } from "react";
import { Code2, Copy, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateOption } from "../hooks/use-update-option";

const PRICES_KEY = "gpt_image1_price_setting.prices";
const DEFAULT_PRICE_KEY = "gpt_image1_price_setting.default_price";
const USE_GROUP_RATIO_KEY = "gpt_image1_price_setting.use_group_ratio";

const QUALITIES = ["low", "medium", "high"] as const;
const SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;

type PriceGrid = Record<string, Record<string, number>>;

const DEFAULT_PRICE_GRID: PriceGrid = {
  low: { "1024x1024": 0.011, "1024x1536": 0.016, "1536x1024": 0.016 },
  medium: { "1024x1024": 0.042, "1024x1536": 0.063, "1536x1024": 0.063 },
  high: { "1024x1024": 0.167, "1024x1536": 0.25, "1536x1024": 0.25 },
};
const DEFAULT_DEFAULT_PRICE = 0.042;
const DEFAULT_USE_GROUP_RATIO = false;

function cloneGrid(grid: PriceGrid): PriceGrid {
  const out: PriceGrid = {};
  for (const quality of Object.keys(grid)) {
    out[quality] = { ...grid[quality] };
  }
  return out;
}

function parsePriceGrid(rawValue: string | undefined): PriceGrid {
  if (!rawValue) return cloneGrid(DEFAULT_PRICE_GRID);
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const result: PriceGrid = {};
      for (const [quality, sizes] of Object.entries(
        parsed as Record<string, unknown>,
      )) {
        if (sizes && typeof sizes === "object" && !Array.isArray(sizes)) {
          result[quality] = { ...(sizes as Record<string, number>) };
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
  } catch {
    // fall through to defaults
  }
  return cloneGrid(DEFAULT_PRICE_GRID);
}

type GPTImagePriceSettingsProps = {
  pricesDefault: string;
  defaultPriceDefault: number;
  useGroupRatioDefault: boolean;
};

export const GPTImagePriceSettings = memo(function GPTImagePriceSettings({
  pricesDefault,
  defaultPriceDefault,
  useGroupRatioDefault,
}: GPTImagePriceSettingsProps) {
  const { t } = useTranslation();
  const updateOption = useUpdateOption();
  const [editMode, setEditMode] = useState<"visual" | "json">("visual");
  const [grid, setGrid] = useState<PriceGrid>(cloneGrid(DEFAULT_PRICE_GRID));
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [defaultPrice, setDefaultPrice] = useState(defaultPriceDefault);
  const [useGroupRatio, setUseGroupRatio] = useState(useGroupRatioDefault);

  useEffect(() => {
    const parsed = parsePriceGrid(pricesDefault);
    setGrid(parsed);
    setJsonText(JSON.stringify(parsed, null, 2));
    setJsonError("");
    setDefaultPrice(defaultPriceDefault);
    setUseGroupRatio(useGroupRatioDefault);
  }, [pricesDefault, defaultPriceDefault, useGroupRatioDefault]);

  const syncFromGrid = useCallback((next: PriceGrid) => {
    setGrid(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError("");
  }, []);

  const handleJsonChange = useCallback(
    (text: string) => {
      setJsonText(text);
      try {
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setJsonError(t("JSON must be an object"));
          return;
        }
        const next: PriceGrid = {};
        for (const [quality, sizes] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (sizes && typeof sizes === "object" && !Array.isArray(sizes)) {
            next[quality] = { ...(sizes as Record<string, number>) };
          }
        }
        setGrid(next);
        setJsonError("");
      } catch (error) {
        setJsonError(
          error instanceof Error ? error.message : t("Invalid JSON"),
        );
      }
    },
    [t],
  );

  const updateCell = useCallback(
    (quality: string, size: string, value: number) => {
      const next = cloneGrid(grid);
      if (!next[quality]) next[quality] = {};
      next[quality][size] = value;
      syncFromGrid(next);
    },
    [grid, syncFromGrid],
  );

  const resetToDefault = useCallback(() => {
    setGrid(cloneGrid(DEFAULT_PRICE_GRID));
    setJsonText(JSON.stringify(DEFAULT_PRICE_GRID, null, 2));
    setDefaultPrice(DEFAULT_DEFAULT_PRICE);
    setUseGroupRatio(DEFAULT_USE_GROUP_RATIO);
    setJsonError("");
  }, []);

  const handleCopyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      toast.success(t("Copied to clipboard"));
    } catch {
      toast.error(t("Failed to copy"));
    }
  }, [jsonText, t]);

  const handleSave = useCallback(async () => {
    if (editMode === "json" && jsonError) {
      toast.error(t("Please fix JSON errors before saving"));
      return;
    }
    await updateOption.mutateAsync({
      key: PRICES_KEY,
      value: JSON.stringify(grid),
    });
    await updateOption.mutateAsync({
      key: DEFAULT_PRICE_KEY,
      value: String(defaultPrice),
    });
    await updateOption.mutateAsync({
      key: USE_GROUP_RATIO_KEY,
      value: String(useGroupRatio),
    });
  }, [editMode, jsonError, t, updateOption, grid, defaultPrice, useGroupRatio]);

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => (prev === "visual" ? "json" : "visual"));
  }, []);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="space-y-1 text-sm">
          <div>
            {t(
              "Per-call unit prices ($/call) for GPT image generation, keyed by quality and size.",
            )}
          </div>
          <div>
            {t(
              "When the group-ratio toggle is off, the image surcharge ignores the group ratio, which stops low-price groups from running at a loss. Turn it on to restore the legacy behavior.",
            )}
          </div>
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <Label>
            {t("Default unit price (fallback when quality/size is missing)")}
          </Label>
          <Input
            type="number"
            min={0}
            step={0.001}
            className="w-48"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(Number(e.target.value) || 0)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={useGroupRatio} onCheckedChange={setUseGroupRatio} />
          <Label>
            {t(
              "Apply group ratio to image surcharge (enable to restore legacy behavior)",
            )}
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {editMode === "json" ? (
          <Button variant="ghost" size="sm" onClick={handleCopyJson}>
            <Copy className="mr-2 h-4 w-4" />
            {t("Copy")}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={resetToDefault}>
          {t("Restore defaults")}
        </Button>
        <Button variant="outline" size="sm" onClick={toggleEditMode}>
          {editMode === "visual" ? (
            <>
              <Code2 className="mr-2 h-4 w-4" />
              {t("Switch to JSON")}
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              {t("Switch to Visual")}
            </>
          )}
        </Button>
      </div>

      {editMode === "visual" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="p-2 text-left font-medium">{t("Quality")}</th>
                {SIZES.map((size) => (
                  <th key={size} className="p-2 text-right font-medium">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QUALITIES.map((quality) => (
                <tr key={quality} className="border-b last:border-0">
                  <td className="p-2 font-medium capitalize">{quality}</td>
                  {SIZES.map((size) => (
                    <td key={size} className="p-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.001}
                        className="ml-auto w-28"
                        value={grid[quality]?.[size] ?? 0}
                        onChange={(e) =>
                          updateCell(quality, size, Number(e.target.value) || 0)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="font-mono text-sm"
            rows={12}
            spellCheck={false}
          />
          {jsonError ? (
            <p className="text-destructive text-sm">{jsonError}</p>
          ) : null}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={
            updateOption.isPending || (editMode === "json" && !!jsonError)
          }
        >
          {t("Save GPT image prices")}
        </Button>
      </div>
    </div>
  );
});
