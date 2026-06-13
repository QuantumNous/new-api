import type { Locale } from "./locales";

type Copy = {
  nav: {
    pricing: string;
    rankings: string;
    blog: string;
    about: string;
    app: string;
    signIn: string;
    toggle: string;
  };
  home: {
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
};

const copies: Record<Locale, Copy> = {
  en: {
    nav: {
      pricing: "Pricing",
      rankings: "Rankings",
      blog: "Blog",
      about: "About",
      app: "Open app",
      signIn: "Sign in",
      toggle: "Toggle navigation menu",
    },
    home: {
      title: "One API gateway for production AI teams",
      description:
        "flatkey.ai unifies model access, routing, billing, usage analytics, and operational controls for teams shipping AI products.",
      primary: "View pricing",
      secondary: "Read the blog",
    },
  },
  zh: {
    nav: {
      pricing: "价格",
      rankings: "排行",
      blog: "博客",
      about: "关于",
      app: "打开应用",
      signIn: "登录",
      toggle: "切换导航菜单",
    },
    home: {
      title: "面向生产团队的一站式 AI API 网关",
      description: "flatkey.ai 统一模型接入、路由、计费、用量分析和运营控制，帮助团队稳定交付 AI 产品。",
      primary: "查看价格",
      secondary: "阅读博客",
    },
  },
  es: {
    nav: {
      pricing: "Precios",
      rankings: "Rankings",
      blog: "Blog",
      about: "Acerca de",
      app: "Abrir app",
      signIn: "Iniciar sesión",
      toggle: "Alternar menú de navegación",
    },
    home: {
      title: "Una puerta de enlace API para equipos de IA en producción",
      description:
        "flatkey.ai unifica acceso a modelos, enrutamiento, facturación, analítica de uso y controles operativos.",
      primary: "Ver precios",
      secondary: "Leer el blog",
    },
  },
  fr: {
    nav: {
      pricing: "Tarifs",
      rankings: "Classements",
      blog: "Blog",
      about: "À propos",
      app: "Ouvrir l'app",
      signIn: "Se connecter",
      toggle: "Basculer le menu de navigation",
    },
    home: {
      title: "Une passerelle API pour les équipes IA en production",
      description:
        "flatkey.ai unifie l'accès aux modèles, le routage, la facturation, l'analyse d'usage et les contrôles opérationnels.",
      primary: "Voir les tarifs",
      secondary: "Lire le blog",
    },
  },
  pt: {
    nav: {
      pricing: "Preços",
      rankings: "Rankings",
      blog: "Blog",
      about: "Sobre",
      app: "Abrir app",
      signIn: "Entrar",
      toggle: "Alternar menu de navegação",
    },
    home: {
      title: "Um gateway de API para equipes de IA em produção",
      description:
        "flatkey.ai unifica acesso a modelos, roteamento, cobrança, análise de uso e controles operacionais.",
      primary: "Ver preços",
      secondary: "Ler o blog",
    },
  },
  ru: {
    nav: {
      pricing: "Цены",
      rankings: "Рейтинги",
      blog: "Блог",
      about: "О нас",
      app: "Открыть приложение",
      signIn: "Войти",
      toggle: "Переключить меню навигации",
    },
    home: {
      title: "Единый API-шлюз для AI-команд в продакшене",
      description:
        "flatkey.ai объединяет доступ к моделям, маршрутизацию, биллинг, аналитику использования и операционный контроль.",
      primary: "Смотреть цены",
      secondary: "Читать блог",
    },
  },
  ja: {
    nav: {
      pricing: "料金",
      rankings: "ランキング",
      blog: "ブログ",
      about: "概要",
      app: "アプリを開く",
      signIn: "ログイン",
      toggle: "ナビゲーションメニューを切り替え",
    },
    home: {
      title: "本番 AI チームのための API ゲートウェイ",
      description:
        "flatkey.ai はモデル接続、ルーティング、課金、利用分析、運用管理を一つにまとめます。",
      primary: "料金を見る",
      secondary: "ブログを読む",
    },
  },
  vi: {
    nav: {
      pricing: "Giá",
      rankings: "Xếp hạng",
      blog: "Blog",
      about: "Giới thiệu",
      app: "Mở ứng dụng",
      signIn: "Đăng nhập",
      toggle: "Bật/tắt menu điều hướng",
    },
    home: {
      title: "Một cổng API cho đội ngũ AI vận hành sản phẩm",
      description:
        "flatkey.ai hợp nhất truy cập mô hình, định tuyến, tính phí, phân tích sử dụng và kiểm soát vận hành.",
      primary: "Xem giá",
      secondary: "Đọc blog",
    },
  },
};

export function getCopy(locale: Locale): Copy {
  return copies[locale] ?? copies.en;
}
