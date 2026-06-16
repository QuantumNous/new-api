import type { Locale } from "@/lib/locales";
import { getDefaultLegalDocument, type LegalDocumentKind } from "./legal/default-documents";

type PageContent = {
  title: string;
  description: string;
  eyebrow: string;
  sections?: { title: string; body: string }[];
  document?: string;
  updated?: string;
};

const generic: Record<string, Omit<PageContent, "eyebrow">> = {
  pricing: {
    title: "Transparent AI model pricing",
    description:
      "Compare model access, routing, and billing options for production AI workloads on flatkey.ai.",
    sections: [
      { title: "Unified billing", body: "Track spend across providers, models, users, keys, and projects from one place." },
      { title: "Operational control", body: "Use routing, quotas, and analytics to keep production usage predictable." },
      { title: "Procurement ready", body: "Keep public pricing discoverable while detailed account controls stay in the app." },
    ],
  },
  rankings: {
    title: "AI model rankings and market signals",
    description:
      "Explore model availability, usage trends, and operational signals for teams choosing production AI models.",
    sections: [
      { title: "Model visibility", body: "Compare popular models by availability, usage, and platform fit." },
      { title: "Routing context", body: "Use rankings as a starting point for fallback and routing decisions." },
      { title: "Updated signals", body: "Public rankings can be generated server-side without depending on client JavaScript." },
    ],
  },
  about: {
    title: "About flatkey.ai",
    description:
      "flatkey.ai helps teams operate AI APIs with routing, billing, analytics, and access controls in one gateway.",
    sections: [
      { title: "Built for operators", body: "The product focuses on reliability, cost clarity, and day-to-day AI API operations." },
      { title: "Provider neutral", body: "Teams can connect multiple upstream providers while keeping one client-facing API." },
      { title: "Production first", body: "The public website is now separated from the application shell so search engines receive real HTML." },
    ],
  },
  terms: {
    title: "Terms of Service",
    description: "Read the terms that govern accounts, prepaid balance, model access, usage, billing, refunds, and dispute handling for flatkey.ai.",
    sections: [],
  },
  privacy: {
    title: "Privacy Policy",
    description: "Learn how flatkey.ai collects, uses, shares, retains, and protects account, payment, API usage, support, and security information.",
    sections: [],
  },
  sla: {
    title: "Service Level Agreement",
    description: "Review flatkey.ai availability scope, incident handling, maintenance, exclusions, support process, and remedies.",
    sections: [],
  },
  "refund-policy": {
    title: "Refund Policy",
    description: "Review how flatkey.ai handles refund eligibility, unused balance, consumed API usage, duplicate charges, disputes, taxes, and support requests.",
    sections: [],
  },
};


const localizedPageCopy: Record<Locale, Record<keyof typeof generic, { title: string; description: string }>> = {
  en: {
    pricing: { title: "Transparent AI model pricing", description: "Compare model access, routing, and billing options for production AI workloads on flatkey.ai." },
    rankings: { title: "AI model rankings and market signals", description: "Explore model availability, usage trends, and operational signals for teams choosing production AI models." },
    about: { title: "About flatkey.ai", description: "flatkey.ai helps teams operate AI APIs with routing, billing, analytics, and access controls in one gateway." },
    terms: { title: "Terms of Service", description: "Read the terms that govern accounts, prepaid balance, model access, usage, billing, refunds, and dispute handling for flatkey.ai." },
    privacy: { title: "Privacy Policy", description: "Learn how flatkey.ai collects, uses, shares, retains, and protects account, payment, API usage, support, and security information." },
    sla: { title: "Service Level Agreement", description: "Review flatkey.ai availability scope, incident handling, maintenance, exclusions, support process, and remedies." },
    "refund-policy": { title: "Refund Policy", description: "Review how flatkey.ai handles refund eligibility, unused balance, consumed API usage, duplicate charges, disputes, taxes, and support requests." },
  },
  zh: {
    pricing: { title: "透明的 AI 模型定价", description: "比较 flatkey.ai 上生产级 AI 工作负载的模型接入、路由和账单方案。" },
    rankings: { title: "AI 模型排行与市场信号", description: "探索模型可用性、使用趋势和运营信号，帮助团队选择生产环境 AI 模型。" },
    about: { title: "关于 flatkey.ai", description: "flatkey.ai 通过一个网关帮助团队运营 AI API，集中管理路由、计费、分析和访问控制。" },
    terms: { title: "服务条款", description: "阅读适用于 flatkey.ai 账号、预付余额、模型接入、用量、账单、退款和争议处理的条款。" },
    privacy: { title: "隐私政策", description: "了解 flatkey.ai 如何收集、使用、共享、保留和保护账号、支付、API 用量、支持与安全信息。" },
    sla: { title: "服务等级协议", description: "查看 flatkey.ai 的可用性范围、事件处理、维护、排除项、支持流程和补救方式。" },
    "refund-policy": { title: "退款政策", description: "了解 flatkey.ai 如何处理退款资格、未使用余额、已消耗 API 用量、重复扣款、争议、税费和支持请求。" },
  },
  es: {
    pricing: { title: "Precios transparentes de modelos de IA", description: "Compara acceso a modelos, enrutamiento y opciones de facturación para cargas de IA en producción en flatkey.ai." },
    rankings: { title: "Rankings de modelos de IA y señales de mercado", description: "Explora disponibilidad, tendencias de uso y señales operativas para equipos que eligen modelos de IA en producción." },
    about: { title: "Acerca de flatkey.ai", description: "flatkey.ai ayuda a los equipos a operar APIs de IA con enrutamiento, facturación, analítica y controles de acceso en un gateway." },
    terms: { title: "Términos del servicio", description: "Lee los términos que rigen cuentas, saldo prepago, acceso a modelos, uso, facturación, reembolsos y disputas en flatkey.ai." },
    privacy: { title: "Política de privacidad", description: "Conoce cómo flatkey.ai recopila, usa, comparte, conserva y protege información de cuenta, pagos, uso de API, soporte y seguridad." },
    sla: { title: "Acuerdo de nivel de servicio", description: "Revisa el alcance de disponibilidad, incidentes, mantenimiento, exclusiones, soporte y remedios de flatkey.ai." },
    "refund-policy": { title: "Política de reembolso", description: "Revisa cómo flatkey.ai gestiona elegibilidad de reembolso, saldo no usado, uso de API consumido, cargos duplicados, disputas, impuestos y soporte." },
  },
  fr: {
    pricing: { title: "Tarifs transparents des modèles IA", description: "Comparez l'accès aux modèles, le routage et la facturation pour les charges IA en production sur flatkey.ai." },
    rankings: { title: "Classements de modèles IA et signaux du marché", description: "Explorez disponibilité, tendances d'usage et signaux opérationnels pour choisir des modèles IA de production." },
    about: { title: "À propos de flatkey.ai", description: "flatkey.ai aide les équipes à exploiter les API IA avec routage, facturation, analyse et contrôles d'accès dans une passerelle." },
    terms: { title: "Conditions d'utilisation", description: "Lisez les conditions qui régissent comptes, solde prépayé, accès aux modèles, usage, facturation, remboursements et litiges sur flatkey.ai." },
    privacy: { title: "Politique de confidentialité", description: "Découvrez comment flatkey.ai collecte, utilise, partage, conserve et protège les informations de compte, paiement, usage API, support et sécurité." },
    sla: { title: "Accord de niveau de service", description: "Consultez le périmètre de disponibilité, la gestion des incidents, la maintenance, les exclusions, le support et les recours de flatkey.ai." },
    "refund-policy": { title: "Politique de remboursement", description: "Découvrez comment flatkey.ai traite l'éligibilité au remboursement, le solde inutilisé, l'usage API consommé, les doublons, litiges, taxes et demandes de support." },
  },
  pt: {
    pricing: { title: "Preços transparentes de modelos de IA", description: "Compare acesso a modelos, roteamento e opções de cobrança para cargas de IA em produção na flatkey.ai." },
    rankings: { title: "Rankings de modelos de IA e sinais de mercado", description: "Explore disponibilidade, tendências de uso e sinais operacionais para equipes que escolhem modelos de IA em produção." },
    about: { title: "Sobre flatkey.ai", description: "flatkey.ai ajuda equipes a operar APIs de IA com roteamento, cobrança, análise e controles de acesso em um gateway." },
    terms: { title: "Termos de serviço", description: "Leia os termos que regem contas, saldo pré-pago, acesso a modelos, uso, cobrança, reembolsos e disputas na flatkey.ai." },
    privacy: { title: "Política de privacidade", description: "Saiba como flatkey.ai coleta, usa, compartilha, retém e protege informações de conta, pagamento, uso de API, suporte e segurança." },
    sla: { title: "Acordo de nível de serviço", description: "Revise o escopo de disponibilidade, incidentes, manutenção, exclusões, suporte e remédios da flatkey.ai." },
    "refund-policy": { title: "Política de reembolso", description: "Revise como flatkey.ai trata elegibilidade de reembolso, saldo não usado, uso de API consumido, cobranças duplicadas, disputas, impostos e suporte." },
  },
  ru: {
    pricing: { title: "Прозрачные цены AI-моделей", description: "Сравнивайте доступ к моделям, маршрутизацию и биллинг для production AI-нагрузок на flatkey.ai." },
    rankings: { title: "Рейтинги AI-моделей и рыночные сигналы", description: "Изучайте доступность моделей, тренды использования и операционные сигналы для выбора production AI-моделей." },
    about: { title: "О flatkey.ai", description: "flatkey.ai помогает командам управлять AI API через единый шлюз с маршрутизацией, биллингом, аналитикой и контролем доступа." },
    terms: { title: "Условия использования", description: "Ознакомьтесь с условиями для аккаунтов, предоплаченного баланса, доступа к моделям, использования, биллинга, возвратов и споров flatkey.ai." },
    privacy: { title: "Политика конфиденциальности", description: "Узнайте, как flatkey.ai собирает, использует, передает, хранит и защищает данные аккаунта, платежей, API, поддержки и безопасности." },
    sla: { title: "Соглашение об уровне обслуживания", description: "Изучите область доступности flatkey.ai, обработку инцидентов, обслуживание, исключения, поддержку и средства защиты." },
    "refund-policy": { title: "Политика возврата средств", description: "Узнайте, как flatkey.ai рассматривает право на возврат, неиспользованный баланс, использованный API, дубли платежей, споры, налоги и поддержку." },
  },
  ja: {
    pricing: { title: "透明な AI モデル料金", description: "flatkey.ai で本番 AI ワークロード向けのモデル接続、ルーティング、請求オプションを比較できます。" },
    rankings: { title: "AI モデルランキングと市場シグナル", description: "本番 AI モデルを選ぶチーム向けに、モデル可用性、利用トレンド、運用シグナルを確認できます。" },
    about: { title: "flatkey.ai について", description: "flatkey.ai は、ルーティング、請求、分析、アクセス制御をひとつのゲートウェイにまとめ、AI API 運用を支援します。" },
    terms: { title: "利用規約", description: "flatkey.ai のアカウント、プリペイド残高、モデルアクセス、利用、請求、返金、紛争処理に適用される規約を確認できます。" },
    privacy: { title: "プライバシーポリシー", description: "flatkey.ai がアカウント、支払い、API 利用、サポート、セキュリティ情報をどのように収集、使用、共有、保持、保護するかを確認できます。" },
    sla: { title: "サービスレベル契約", description: "flatkey.ai の可用性範囲、インシデント対応、メンテナンス、除外事項、サポート、救済措置を確認できます。" },
    "refund-policy": { title: "返金ポリシー", description: "flatkey.ai が返金資格、未使用残高、消費済み API 利用、重複請求、紛争、税金、サポート依頼をどう扱うかを確認できます。" },
  },
  vi: {
    pricing: { title: "Giá mô hình AI minh bạch", description: "So sánh truy cập mô hình, định tuyến và tùy chọn tính phí cho tải công việc AI production trên flatkey.ai." },
    rankings: { title: "Xếp hạng mô hình AI và tín hiệu thị trường", description: "Khám phá độ sẵn sàng, xu hướng sử dụng và tín hiệu vận hành để chọn mô hình AI production." },
    about: { title: "Giới thiệu flatkey.ai", description: "flatkey.ai giúp đội ngũ vận hành API AI với định tuyến, tính phí, phân tích và kiểm soát truy cập trong một gateway." },
    terms: { title: "Điều khoản dịch vụ", description: "Đọc các điều khoản điều chỉnh tài khoản, số dư trả trước, truy cập mô hình, sử dụng, tính phí, hoàn tiền và tranh chấp của flatkey.ai." },
    privacy: { title: "Chính sách quyền riêng tư", description: "Tìm hiểu cách flatkey.ai thu thập, sử dụng, chia sẻ, lưu giữ và bảo vệ thông tin tài khoản, thanh toán, sử dụng API, hỗ trợ và bảo mật." },
    sla: { title: "Thỏa thuận mức dịch vụ", description: "Xem phạm vi sẵn sàng, xử lý sự cố, bảo trì, ngoại lệ, quy trình hỗ trợ và biện pháp khắc phục của flatkey.ai." },
    "refund-policy": { title: "Chính sách hoàn tiền", description: "Xem cách flatkey.ai xử lý điều kiện hoàn tiền, số dư chưa dùng, API đã tiêu thụ, khoản tính trùng, tranh chấp, thuế và yêu cầu hỗ trợ." },
  },
};

const legalDocumentByPage: Partial<Record<keyof typeof generic, LegalDocumentKind>> = {
  terms: "terms",
  privacy: "privacy",
  sla: "sla",
  "refund-policy": "refund",
};

function getMarkdownTitle(markdown: string): string | undefined {
  return markdown
    .split("\n")
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim();
}

const eyebrowByLocale: Record<Locale, string> = {
  en: "Official website",
  zh: "官方网站",
  es: "Sitio oficial",
  fr: "Site officiel",
  pt: "Site oficial",
  ru: "Официальный сайт",
  ja: "公式サイト",
  vi: "Trang chính thức",
};

export type PublicPageKey = keyof typeof generic;

export function getPageContent(key: PublicPageKey, locale: Locale): PageContent {
  const legalKind = legalDocumentByPage[key];
  const document = legalKind ? getDefaultLegalDocument(legalKind, locale) : undefined;
  const localized = localizedPageCopy[locale]?.[key] ?? localizedPageCopy.en[key];
  const title = document ? (getMarkdownTitle(document) ?? localized.title) : localized.title;
  return {
    ...generic[key],
    title,
    description: localized.description,
    eyebrow: eyebrowByLocale[locale] ?? eyebrowByLocale.en,
    document,
    updated: legalKind ? "June 4, 2026" : undefined,
  };
}
