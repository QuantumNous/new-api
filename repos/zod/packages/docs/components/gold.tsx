type Company = {
  name: string;
  description: string;
  logoDark: string;
  logoLight: string;
  url: string;
  href: string;
  logoClassName?: string;
};

export const Gold = () => {
  const companies: Company[] = [
    {
      name: "Zernio",
      description: "Social APIs for developers and AI agents",
      logoDark: "https://zernio.com/brand/logo-white.svg",
      logoLight: "https://zernio.com/brand/logo-primary.svg",
      logoClassName: "h-12",
      url: "zernio.com",
      href: "https://zernio.com/?utm_source=zod",
    },
    {
      name: "Neon",
      description: "Serverless Postgres — Ship faster",
      logoDark: "https://github.com/user-attachments/assets/83b4b1b1-a9ab-4ae5-a632-56d282f0c444",
      logoLight: "https://github.com/user-attachments/assets/b5799fc8-81ff-4053-a1c3-b29adf85e7a1",
      url: "neon.tech",
      href: "https://neon.tech",
    },
    {
      name: "Stainless",
      description: "Generate best-in-class SDKs",
      logoDark: "https://github.com/colinhacks/zod/assets/3084745/f20759c1-3e51-49d0-a31e-bbc43abec665",
      logoLight: "https://github.com/colinhacks/zod/assets/3084745/e9444e44-d991-4bba-a697-dbcfad608e47",
      logoClassName: "h-12",
      url: "stainlessapi.com",
      href: "https://stainlessapi.com",
    },
  ];

  return (
    <div className="max-w-4xl mt-4">
      <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-md">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {companies.map((company) => (
            <div
              key={company.name}
              className="p-4 flex flex-col items-center border-b border-r border-gray-200 dark:border-gray-700 last:border-b-0 "
            >
              <a href={company.href} target="_blank" rel="noopener noreferrer" className="my-0! border-none">
                <img
                  src={company.logoLight}
                  alt={`${company.name} logo (light theme)`}
                  className={`my-0! object-contain dark:hidden ${company.logoClassName ?? "h-16"}`}
                />
                <img
                  src={company.logoDark}
                  alt={`${company.name} logo (dark theme)`}
                  className={`my-0! object-contain hidden dark:block ${company.logoClassName ?? "h-16"}`}
                />
              </a>

              <p className="mt-3 mb-0 text-center text-sm text-gray-600 dark:text-gray-400">{company.description}</p>
              <a
                href={company.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {company.url}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
