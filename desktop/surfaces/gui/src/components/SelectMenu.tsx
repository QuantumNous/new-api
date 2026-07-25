import { useEffect, useState } from "react";
import { Icon } from "./Icon";

// A form-styled custom select (the native <select> can't carry status dots or sub-lines and
// looks like a raw OS control next to the rest of the UI). Rows: label, an optional quiet
// second line ("Last used 2h ago"), and an optional green status dot on the far right.
export interface SelectMenuOption {
  value: string;
  label: string;
  sub?: string; // quiet second line under the label
  dot?: boolean; // green status dot at the row's far right (e.g. "key set")
  group?: string; // optional section header; consecutive options with the same group share it
}

export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const current = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-line bg-paper text-[13px] text-ink hover:border-lineStrong"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex-1 min-w-0 text-left truncate">{current?.label || value}</span>
        {current?.dot && <span className="w-1.5 h-1.5 rounded-full bg-ok shrink-0" />}
        <Icon name="chevronDown" size={13} className="text-faint shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label={ariaLabel}
            className="absolute z-40 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-panel shadow-xl p-1"
          >
            {options.map((o, i) => {
              const sel = o.value === value;
              const header =
                o.group && o.group !== options[i - 1]?.group ? (
                  <div
                    className={
                      "px-2.5 pb-1 text-[10.5px] uppercase tracking-[0.06em] text-faint font-semibold " +
                      (i === 0 ? "pt-1" : "pt-2.5 mt-1.5 border-t border-line")
                    }
                  >
                    {o.group}
                  </div>
                ) : null;
              return (
                <div key={o.value}>
                  {header}
                  <button
                    type="button"
                    role="option"
                  aria-selected={sel}
                  className={
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left " +
                    (sel ? "bg-paper" : "hover:bg-paper")
                  }
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        "block text-[13px] truncate " + (sel ? "font-semibold text-ink" : "text-ink")
                      }
                    >
                      {o.label}
                    </span>
                    {o.sub && <span className="block text-[11.5px] text-faint truncate">{o.sub}</span>}
                  </span>
                  {sel && <span className="text-accent text-[12px] shrink-0">✓</span>}
                  <span
                    className={
                      "w-1.5 h-1.5 rounded-full shrink-0 " + (o.dot ? "bg-ok" : "bg-transparent")
                    }
                    title={o.dot ? "Key set" : undefined}
                  />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
