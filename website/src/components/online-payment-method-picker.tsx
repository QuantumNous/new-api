import Image from "next/image";
import { CreditCard } from "lucide-react";

export type OnlinePaymentMethod = {
  ctaHref: string;
  height?: number;
  kind: "card" | "pix" | "upi" | "alipay" | "usdc";
  label: string;
  src?: string;
  width?: number;
};

export function OnlinePaymentMethodPicker(props: {
  ctaLabel: string;
  methods: readonly OnlinePaymentMethod[];
  payWithLabel: string;
}) {
  return (
    <div className="pay">
      <span className="payLabel">{props.payWithLabel}</span>
      {props.methods.map((method) => (
        <span
          className="pm"
          data-payment-method={method.kind}
          key={method.kind}
        >
          <span className={`pmLogo ${method.kind}`} aria-hidden="true">
            <PaymentMethodLogo method={method} />
          </span>
          <span className="pmText">{method.label}</span>
        </span>
      ))}
      <div style={{ flex: 1 }} />
      <a className="btn primary big" href={props.methods[0]?.ctaHref ?? "#"}>
        {props.ctaLabel}
      </a>
    </div>
  );
}

function PaymentMethodLogo(props: { method: OnlinePaymentMethod }) {
  if (props.method.kind === "card") return <CreditCard className="size-4" />;
  if (!props.method.src || !props.method.width || !props.method.height) return null;
  return <Image alt="" height={props.method.height} src={props.method.src} width={props.method.width} />;
}
