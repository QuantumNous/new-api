import { PricingModelWheel } from "@/components/pricing/pricing-model-wheel";

export interface PricingCopy {
  title: string;
  description: string;
}

export interface PricingRate {
  label: string;
  multiplier: string;
}

export interface PricingModel {
  name: string;
  logoSrc: string;
  rates: PricingRate[];
  availableModels: string[];
}

interface PricingProps {
  copy: PricingCopy;
  models: PricingModel[];
}

export function Pricing({ copy, models }: PricingProps) {
  return (
    <section
      aria-label="付费方案"
      className="mx-auto w-full max-w-[1600px] px-3 pb-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5"
    >
      <article className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white lg:grid lg:min-h-[30rem] lg:grid-cols-[minmax(20rem,0.65fr)_minmax(0,1.35fr)] lg:rounded-[2rem]">
        <div className="flex min-h-[18rem] items-center p-6 sm:p-8 lg:min-h-0 lg:p-10">
          <div className="max-w-md">
            <h2 className="max-w-xl text-lg leading-[1.15] font-bold tracking-[-0.025em] text-neutral-950 sm:text-xl lg:text-2xl lg:leading-[1.08] lg:tracking-[-0.035em]">
              {copy.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed font-medium text-neutral-500 sm:mt-4 sm:text-base">
              {copy.description}
            </p>
          </div>
        </div>

        <div className="border-t border-black/[0.06] lg:border-t-0 lg:border-l">
          <PricingModelWheel models={models} />
        </div>
      </article>
    </section>
  );
}
