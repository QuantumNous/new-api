import { type CSSProperties } from "react";

import { UseCasesList, type UseCaseItem } from "@/components/offers/use-cases-list";
import { VoucherArtwork, type VoucherImage } from "@/components/offers/voucher-artwork";

export interface OfferCopy {
  title: string;
  description: string;
}

export interface VoucherPlan {
  href: string;
  paymentLabel: string;
  payment: string;
  bonusLabel: string;
  bonus: string;
  totalLabel: string;
  total: string;
  color: string;
}

interface OffersProps {
  ariaLabel: string;
  useCases: {
    copy: OfferCopy;
    items: UseCaseItem[];
    recommendationLabel: string;
  };
  vouchers: {
    copy: OfferCopy;
    plans: VoucherPlan[];
    images: VoucherImage[];
  };
}

const cardTitleClassName =
  "max-w-xl text-lg leading-[1.15] font-bold tracking-[-0.025em] text-neutral-950 sm:text-xl lg:text-2xl lg:leading-[1.08] lg:tracking-[-0.035em]";

const cardDescriptionClassName =
  "mt-3 max-w-xl text-sm leading-relaxed font-medium text-neutral-500 sm:mt-4 sm:text-base";

function UseCasesCard({ copy, items, recommendationLabel }: OffersProps["useCases"]) {
  return (
    <article className="flex min-w-0 flex-col rounded-3xl border border-black/[0.06] bg-white p-4 select-none sm:p-8 lg:min-h-[34rem] lg:rounded-[2rem] lg:p-10">
      <header>
        <h2 className={cardTitleClassName}>{copy.title}</h2>
        <p className={cardDescriptionClassName}>{copy.description}</p>
      </header>

      <UseCasesList items={items} recommendationLabel={recommendationLabel} />
    </article>
  );
}

function VoucherPlanCard({ plan }: { plan: VoucherPlan }) {
  return (
    <a
      href={plan.href}
      aria-label={`${plan.paymentLabel} ${plan.payment}，${plan.totalLabel} ${plan.total}`}
      style={{ "--voucher-color": plan.color } as CSSProperties}
      className="block rounded-2xl border border-black/[0.06] bg-neutral-50/80 p-4 transition-[border-color,background-color,box-shadow] duration-300 ease-out hover:border-neutral-300 hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--voucher-color)] focus-visible:ring-offset-2 focus-visible:outline-none sm:p-5"
    >
      <dl className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 sm:gap-4">
        <div>
          <dt className="text-sm font-semibold text-neutral-500 sm:text-base">
            {plan.paymentLabel}
          </dt>
          <dd className="mt-1 text-2xl leading-none font-bold tracking-[-0.04em] text-neutral-950 sm:text-3xl">
            {plan.payment}
          </dd>
        </div>

        <div className="pb-0.5 text-center">
          <dt className="text-sm font-semibold text-neutral-500 sm:text-base">{plan.bonusLabel}</dt>
          <dd className="mt-1 text-lg leading-none font-bold tracking-[-0.025em] text-[var(--voucher-color)] sm:text-xl">
            {plan.bonus}
          </dd>
        </div>

        <div className="text-right">
          <dt className="text-sm font-semibold text-neutral-500 sm:text-base">{plan.totalLabel}</dt>
          <dd className="mt-1 text-2xl leading-none font-bold tracking-[-0.04em] text-neutral-950 sm:text-3xl">
            {plan.total}
          </dd>
        </div>
      </dl>
    </a>
  );
}

function VouchersCard({ copy, plans, images }: OffersProps["vouchers"]) {
  return (
    <article className="grid min-w-0 overflow-hidden rounded-3xl border border-black/[0.06] bg-white lg:min-h-[34rem] lg:grid-cols-[minmax(21rem,0.92fr)_minmax(20rem,1.08fr)] lg:rounded-[2rem]">
      <div className="flex min-w-0 flex-col p-6 sm:p-8 lg:p-10">
        <header>
          <h2 className={cardTitleClassName}>{copy.title}</h2>
          <p className={cardDescriptionClassName}>{copy.description}</p>
        </header>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 lg:mt-auto lg:pt-10">
          {plans.map((plan) => (
            <VoucherPlanCard key={`${plan.payment}-${plan.total}`} plan={plan} />
          ))}
        </div>
      </div>

      <div className="flex min-h-64 items-center overflow-hidden bg-neutral-50 px-3 py-5 sm:min-h-80 sm:px-8 sm:py-6 lg:min-h-0 lg:border-l lg:border-black/[0.06] lg:px-5 lg:py-8 xl:px-7">
        <VoucherArtwork images={images} />
      </div>
    </article>
  );
}

export function Offers({ ariaLabel, useCases, vouchers }: OffersProps) {
  return (
    <section
      aria-label={ariaLabel}
      className="mx-auto grid w-full max-w-[1600px] gap-3 px-3 pb-24 sm:gap-4 sm:px-4 sm:pb-28 lg:grid-cols-[minmax(20rem,0.65fr)_minmax(0,1.35fr)] lg:gap-5 lg:px-5 lg:pb-32"
    >
      <UseCasesCard {...useCases} />
      <VouchersCard {...vouchers} />
    </section>
  );
}
