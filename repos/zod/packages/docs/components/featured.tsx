type FeatureData = {
  name: string;
  link: string;
  lightImage: string;
  darkImage: string;
};

export function Featured(props: { data: FeatureData }) {
  const { data: feature } = props;
  return (
    <>
      <h2
        style={{ borderBottom: "1px solid hsla(0, 0%, 100%, 0.1)" }}
        // className="font-semibold w-full text-center pb-2 border-b border-gray-900 border-solid text-xl"
        className="text-center wide m-0!"
      >
        Featured sponsor: {feature.name}
      </h2>
      <div className="w-full flex flex-col items-stretch">
        <a href={feature.link} className="mt-0 mb-0 border-none">
          <div className="h-[320px] flex justify-center items-center m-1">
            <picture className="h-[300px] flex items-center m-0!">
              <source media="(prefers-color-scheme: dark)" srcSet={feature.darkImage} />
              <img alt={`${feature.name} logo`} src={feature.lightImage} className="max-h-[300px] w-auto" />
            </picture>
          </div>
        </a>
        <p className="mt-0 mb-0 text-xs text-center">
          Interested in featuring?{" "}
          <a target="_blank" rel="noopener noreferrer" href="mailto:sponsorship@colinhacks.com">
            Get in touch.
          </a>
        </p>
      </div>
    </>
  );
}

// <h2 align="center">Featured sponsor: Fern</h2>

// <div align="center">
//   <a href="https://link.buildwithfern.com/zod-partnership">
//     <picture width="95%" >
//       <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/995d60b8-2ad9-4ba5-9b08-c41ec8c2cb45">
//       <img alt="fern logo" src="https://github.com/user-attachments/assets/b140d9bd-dfd3-4d97-a059-c3eda10d2840" width="95%">
//     </picture>
//   </a>
//   <br/>
//   <p><sub>Learn more about <a target="_blank" rel="noopener noreferrer" href="mailto:sponsorship@colinhacks.com">featured sponsorships</a></sub></p>
// </div>
