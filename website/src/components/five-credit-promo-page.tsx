import { ArrowRight, CheckCircle2, CreditCard, Gift, Layers3, ShieldCheck, WalletCards, Zap } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { consoleUrl } from "@/lib/origins";

export const PROMO_CLAIM_URL = consoleUrl("/redeem", "from=google");

const valuePoints = [
  { label: "Resgate sem recarga inicial", icon: Gift },
  { label: "Pix disponível quando precisar de mais créditos", icon: CreditCard },
  { label: "Vários modelos de IA em uma única plataforma", icon: Layers3 },
];

const steps = [
  "Crie sua conta Flatkey",
  "Resgate seus US$5 em créditos",
  "Comece a usar APIs de IA",
];

const models = ["DeepSeek", "Qwen", "Kimi", "GLM", "Claude", "GPT"];

const reasons = [
  { label: "Créditos prontos para começar", icon: Zap },
  { label: "Vários modelos em uma única plataforma", icon: Layers3 },
  { label: "Pagamento via Pix", icon: WalletCards },
  { label: "Use apenas o que precisar", icon: CheckCircle2 },
];

const conditions = [
  "Válida apenas para novos usuários elegíveis.",
  "O crédito promocional de US$5 pode ser resgatado uma vez por conta.",
  "Não é necessário fazer recarga para resgatar o crédito.",
  "Os créditos promocionais não podem ser sacados ou transferidos.",
  "A promoção pode ser alterada ou encerrada conforme os termos da Flatkey.",
];

export function FiveCreditPromoPage() {
  return (
    <SiteShell locale="pt" pathname="/5-credit-promo" hideLanguageSwitcher>
      <main className="bg-[#f7f8fb] text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.75fr)] lg:px-8 lg:pb-16 lg:pt-14">
            <div className="flex min-w-0 flex-col justify-center">
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                <Gift className="h-4 w-4" aria-hidden="true" />
                Crédito promocional para novos usuários
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
                Ganhe US$5 em créditos para APIs de IA
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
                Crie sua conta na Flatkey, resgate US$5 em créditos e comece a testar APIs de IA.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={PROMO_CLAIM_URL}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
                >
                  Resgatar US$5 em créditos
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <p className="text-sm leading-6 text-slate-600">
                  Crédito promocional para novos usuários. Sem cartão. Limitado a uma vez por conta.
                </p>
              </div>
            </div>

            <aside className="self-center rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">Oferta direta</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Sem necessidade de recarga para resgatar. O crédito é aplicado pelo fluxo de resgate da Flatkey.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {valuePoints.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 rounded-md bg-white px-3 py-3 text-sm font-medium text-slate-800">
                      <Icon className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-slate-950">Como funciona</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <p className="mt-4 text-base font-semibold text-slate-950">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold text-slate-950">Use seus créditos nos modelos que você precisa</h2>
              <p className="mt-3 text-base leading-7 text-slate-700">
                Use uma única plataforma para acessar modelos de IA e APIs para diferentes projetos.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {models.map((model) => (
                <div key={model} className="rounded-lg border border-slate-200 bg-[#f7f8fb] px-4 py-4 text-center text-base font-semibold text-slate-950">
                  {model}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1fr] lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Mais simples para testar APIs de IA</h2>
            <p className="mt-3 text-base leading-7 text-slate-700">
              Comece com crédito promocional, valide seus casos de uso e compre mais créditos depois quando fizer sentido.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {reasons.map((reason) => {
              const Icon = reason.icon;
              return (
                <div key={reason.label} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <p className="text-sm font-semibold leading-6 text-slate-900">{reason.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Condições da promoção</h2>
              <ul className="mt-5 space-y-3">
                {conditions.map((condition) => (
                  <li key={condition} className="flex gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
                    <span>{condition}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-950 p-6 text-white">
              <h2 className="text-2xl font-semibold">Comece a testar APIs de IA com US$5 em créditos</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Resgate o crédito promocional, crie sua chave de API e teste os modelos disponíveis na Flatkey.
              </p>
              <a
                href={PROMO_CLAIM_URL}
                className="mt-6 inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-base font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Resgatar meus US$5
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
