import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteSkill,
  getRecommendedSkills,
  getSkillDetail,
  getSkills,
  installSkill,
  pickFolderViaServer,
  searchSkillsMarket,
  setSkillEnabled,
  type MarketSkill,
  type RecommendedSkill,
  type SkillDetail,
  type SkillInfo,
} from "../api";
import { Markdown } from "./Markdown";
import { Toggle } from "./Toggle";

const CARD = "rounded-xl2 border border-line bg-panel";
const BTN_BORDERED =
  "text-[12.5px] px-3 py-1.5 rounded-lg border border-line hover:bg-paper shrink-0 disabled:opacity-50";
const BTN_ACCENT =
  "text-[12.5px] px-3 py-1.5 rounded-lg bg-accent text-white shrink-0 disabled:opacity-50";
const BTN_DANGER = "text-[12.5px] text-danger/80 hover:text-danger shrink-0";
const TAG =
  "text-[10px] px-1.5 py-0.5 rounded border border-line text-faint uppercase tracking-wide";
const SEC_H = "text-[11px] uppercase tracking-[0.05em] text-faint font-semibold";

// Skills = Anthropic SKILL.md folders (agentskills.io). Three tiers: builtin ships with
// the app (disable-only), global is user-installed, workspace travels with the project.
export function SkillsTab() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [recommended, setRecommended] = useState<RecommendedSkill[]>([]);
  const [adding, setAdding] = useState<null | "git" | "market">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    getSkills().then(setSkills).catch(() => setSkills([]));
    getRecommendedSkills().then(setRecommended).catch(() => setRecommended([]));
  };
  useEffect(() => {
    refresh();
  }, []);

  const report = (res: { ok: boolean; error?: string; name?: string; has_scripts?: boolean }) => {
    if (res.ok) {
      setError(null);
      setNotice(
        res.has_scripts
          ? t("Installed “{{name}}”. It bundles scripts — script runs stay approval-gated.", {
              name: res.name,
            })
          : t("Installed “{{name}}”.", { name: res.name }),
      );
      refresh();
    } else {
      setNotice(null);
      setError(res.error || t("Install failed."));
    }
  };

  const addFromFolder = async () => {
    const path = await pickFolderViaServer();
    if (!path) return;
    report(await installSkill({ source: "path", path }));
  };

  const toggle = async (s: SkillInfo) => {
    await setSkillEnabled(s.name, !s.enabled);
    refresh();
  };
  const remove = async (s: SkillInfo) => {
    const res = await deleteSkill(s.name);
    if (!res.ok) setError(res.error || t("Delete failed."));
    refresh();
  };

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted leading-relaxed">
        {t(
          "Reusable instruction packs (SKILL.md) your coworkers load on demand. Built-in skills ship with the app; install more from a folder, GitHub, or the marketplace. Changes apply to new sessions.",
        )}
      </p>

      {skills.length === 0 ? (
        <div className={CARD + " p-4 text-[13px] text-muted"}>{t("No skills found.")}</div>
      ) : (
        [
          { tier: "builtin", label: t("Included with the app") },
          { tier: "global", label: t("Installed by you") },
          { tier: "workspace", label: t("From this workspace") },
        ].map(({ tier, label }) => {
          const rows = skills.filter((s) => s.source === tier);
          if (rows.length === 0) return null;
          return (
            <section key={tier} data-testid={`skill-group-${tier}`}>
              <div className={SEC_H}>{label}</div>
              <div className="space-y-2 mt-1.5">
                {rows.map((s) => (
                  <SkillRow
                    key={s.name}
                    skill={s}
                    onToggle={() => toggle(s)}
                    onRemove={() => remove(s)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {recommended.some((r) => !r.installed) && (
        <section data-testid="skill-recommended">
          <div className={SEC_H}>{t("Recommended")}</div>
          <p className="text-[11.5px] text-faint mt-1 mb-1.5">
            {t("Reviewed packs from public repositories — downloaded when you add them.")}
          </p>
          <div className="space-y-2">
            {recommended
              .filter((r) => !r.installed)
              .map((r) => (
                <RecommendedRow key={r.name} skill={r} onDone={report} />
              ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button className={BTN_ACCENT} onClick={addFromFolder} data-testid="skill-add-folder">
          {t("Add from folder…")}
        </button>
        <button
          className={BTN_BORDERED}
          onClick={() => setAdding(adding === "git" ? null : "git")}
          data-testid="skill-add-git"
        >
          {t("Add from GitHub…")}
        </button>
        <button
          className={BTN_BORDERED}
          onClick={() => setAdding(adding === "market" ? null : "market")}
          data-testid="skill-add-market"
        >
          {t("Browse marketplace…")}
        </button>
      </div>

      {adding === "git" && (
        <GitInstallForm onDone={report} onCancel={() => setAdding(null)} />
      )}
      {adding === "market" && <MarketSearch onInstalled={report} />}

      {notice && <div className="text-[12.5px] text-muted" data-testid="skill-notice">{notice}</div>}
      {error && <div className="text-[12.5px] text-danger" data-testid="skill-error">{error}</div>}
    </div>
  );
}

function SkillRow({
  skill,
  onToggle,
  onRemove,
}: {
  skill: SkillInfo;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const sourceLabel: Record<string, string> = {
    builtin: t("Built-in"),
    global: t("Installed"),
    workspace: t("Workspace"),
  };

  const toggleDetail = async () => {
    if (detail) {
      setDetail(null);
      return;
    }
    setBusy(true);
    const d = await getSkillDetail(skill.name);
    setBusy(false);
    if (d.ok) setDetail(d);
  };

  return (
    <div className={CARD + " p-3.5"} data-testid={`skill-row-${skill.name}`}>
      <div className="flex items-center gap-3">
        <Toggle checked={skill.enabled} onChange={onToggle} title={t("Enable this skill")} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium flex items-center gap-2">
            {skill.name}
            <span className={TAG}>{sourceLabel[skill.source] ?? skill.source}</span>
            {skill.overrides && (
              <span className={TAG} title={t("A same-named {{tier}} skill is shadowed by this one.", { tier: skill.overrides })}>
                {t("overrides {{tier}}", { tier: skill.overrides })}
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-faint truncate">{skill.description}</div>
        </div>
        <button
          className="text-[12px] text-muted hover:text-ink shrink-0"
          onClick={toggleDetail}
          disabled={busy}
          data-testid={`skill-detail-${skill.name}`}
        >
          {busy ? "…" : detail ? t("hide details") : t("details")}
        </button>
        {skill.source === "global" && (
          <button className={BTN_DANGER} onClick={onRemove} data-testid={`skill-remove-${skill.name}`}>
            {t("remove")}
          </button>
        )}
      </div>
      {detail && (
        <div className="mt-2.5 pt-2.5 border-t border-line space-y-2">
          <div className="max-h-72 overflow-y-auto hairline-scroll text-[12.5px]">
            <Markdown text={detail.instructions || ""} />
          </div>
          {(detail.resources?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(detail.resources ?? []).map((r) => (
                <span
                  key={r}
                  className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-paper border border-line"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          {detail.path && <div className="text-[11px] text-faint font-mono">{detail.path}</div>}
        </div>
      )}
    </div>
  );
}

function RecommendedRow({
  skill,
  onDone,
}: {
  skill: RecommendedSkill;
  onDone: (res: { ok: boolean; error?: string; name?: string; has_scripts?: boolean }) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    const res = await installSkill({ source: "git", url: skill.url, subdir: skill.subdir });
    setBusy(false);
    onDone(res);
  };

  return (
    <div className={CARD + " p-3.5 flex items-center gap-3"} data-testid={`skill-rec-${skill.name}`}>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium flex items-center gap-2">
          {skill.title}
          <span className={TAG}>{skill.license}</span>
        </div>
        <div className="text-[11.5px] text-faint truncate">{skill.description}</div>
      </div>
      <button className={BTN_BORDERED} onClick={add} disabled={busy}>
        {busy ? t("Installing…") : t("Add")}
      </button>
    </div>
  );
}

function GitInstallForm({
  onDone,
  onCancel,
}: {
  onDone: (res: { ok: boolean; error?: string; name?: string; has_scripts?: boolean }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [subdir, setSubdir] = useState("");
  const [busy, setBusy] = useState(false);

  const install = async () => {
    setBusy(true);
    const res = await installSkill({
      source: "git",
      url: url.trim(),
      subdir: subdir.trim() || undefined,
    });
    setBusy(false);
    onDone(res);
  };

  return (
    <div className={CARD + " p-3.5 space-y-2"} data-testid="skill-git-form">
      <div className="text-[13px] font-medium">{t("Install from a GitHub repository")}</div>
      <input
        className="w-full text-[12.5px] px-2.5 py-1.5 rounded-lg border border-line bg-paper font-mono"
        placeholder={t("https://github.com/owner/repo or owner/repo")}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input
        className="w-full text-[12.5px] px-2.5 py-1.5 rounded-lg border border-line bg-paper font-mono"
        placeholder={t("skill folder in the repo (optional, e.g. skills/pdf)")}
        value={subdir}
        onChange={(e) => setSubdir(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <button className={BTN_ACCENT} onClick={install} disabled={busy || !url.trim()}>
          {busy ? t("Installing…") : t("Install")}
        </button>
        <button className={BTN_BORDERED} onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </div>
  );
}

function MarketSearch({
  onInstalled,
}: {
  onInstalled: (res: { ok: boolean; error?: string; name?: string; has_scripts?: boolean }) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MarketSkill[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    const res = await searchSkillsMarket(q.trim());
    setBusy(false);
    if (res.ok) setResults(res.skills);
    else setError(res.error || t("Search failed."));
  };

  const install = async (m: MarketSkill) => {
    setInstalling(m.id);
    const res = await installSkill({ source: "market", id: m.id });
    setInstalling(null);
    onInstalled(res);
  };

  return (
    <div className={CARD + " p-3.5 space-y-2"} data-testid="skill-market">
      <div className="text-[13px] font-medium">{t("Skill marketplace (skills.sh)")}</div>
      <p className="text-[11.5px] text-faint leading-relaxed">
        {t(
          "Community skills from public GitHub repos. Review what you install — instructions are untrusted input, and script runs always stay approval-gated.",
        )}
      </p>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 text-[12.5px] px-2.5 py-1.5 rounded-lg border border-line bg-paper"
          placeholder={t("Search skills — e.g. pdf, changelog, react")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          data-testid="skill-market-query"
        />
        <button className={BTN_ACCENT} onClick={run} disabled={busy || !q.trim()}>
          {busy ? "…" : t("Search")}
        </button>
      </div>
      {error && <div className="text-[12.5px] text-danger">{error}</div>}
      {results && results.length === 0 && (
        <div className="text-[12.5px] text-muted">{t("No results.")}</div>
      )}
      {results?.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-3 py-1.5 border-t border-line first:border-t-0"
          data-testid={`skill-market-result-${m.skill_id}`}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{m.name}</div>
            <div className="text-[11.5px] text-faint truncate">
              {m.source} · {t("{{count}} installs", { count: m.installs })}
            </div>
          </div>
          <button
            className={BTN_BORDERED}
            onClick={() => install(m)}
            disabled={installing !== null}
          >
            {installing === m.id ? t("Installing…") : t("Install")}
          </button>
        </div>
      ))}
    </div>
  );
}
