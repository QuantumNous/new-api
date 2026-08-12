export const Bronze = () => {
  const companies = [
    {
      name: "Jason Laster",
      logoSrc: "https://avatars.githubusercontent.com/u/254562?s=200&v=4",
      url: "github.com/jasonLaster",
      href: "https://github.com/jasonLaster",
    },
    {
      name: "Clipboard",
      logoSrc: "https://avatars.githubusercontent.com/u/28880063?s=200&v=4",
      url: "clipboardhealth.com/engineering",
      href: "https://www.clipboardhealth.com/engineering",
    },
    {
      name: "Convex",
      logoSrc: "https://avatars.githubusercontent.com/u/81530787?s=200&v=4",
      url: "convex.dev",
      href: "https://convex.dev/?utm_source=zod",
    },
    {
      name: "n8n",
      logoSrc: "https://avatars.githubusercontent.com/u/104988782?s=200&v=4",
      url: "n8n.io",
      href: "https://n8n.io/?utm_source=zod",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-md">
        <div className="flex flex-wrap">
          {companies.map((company) => (
            <div
              key={company.name}
              className="p-4 flex flex-col items-center border-b border-r border-gray-200 dark:border-gray-700 last:border-b-0 sm:last-sm:border-b sm:even:last:border-r-0 lg:nth-3:last-3:border-r-0 xl:nth-4:last-4:border-r-0"
            >
              <a
                href={company.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center m-0 border-none"
              >
                <img src={company.logoSrc} alt={`${company.name} logo`} className="h-12 object-contain mb-0 mt-0" />
              </a>
              <a href={company.href} className="hidden">
                <span className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  {company.url}
                </span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
