const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const API_URL = "https://api.github.com/graphql";

export async function fetchStars(resources: { slug: string; stars?: number }[]) {
  try {
    if (resources.length === 0) return;
    const uniqueSlugs = Array.from(
      new Set(
        resources
          .filter((r) => r.stars === undefined)
          .map((r, id) => ({
            id,
            slug: r.slug,
          }))
      )
    );

    if (uniqueSlugs.length === 0) return;

    const queryParts = uniqueSlugs.map(({ id, slug }) => {
      const [owner, name] = slug.split("/");
      return `
      repo${id}: repository(owner: "${owner}", name: "${name}") {
        stargazerCount
      }
    `;
    });

    const query = `{ ${queryParts.join("\n")} }`;
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      next: { revalidate: 86400 }, // Cache for 1 day to match route revalidation
    });

    if (res.status > 400) {
      console.error(
        "Failed to fetch GitHub stars. Make sure you are providing a valid GITHUB_TOKEN in packages/docs/.env"
      );
      if (process.env.NODE_ENV === "production") {
        throw new Error("Failed to fetch GitHub stars.");
      }
      return;
    }

    const json = await res.json();

    if (json.errors) {
      console.dir(json.errors, { depth: null });
      throw new Error("Failed to fetch GitHub stars");
    }

    // Create a map of slug → star count
    const starsMap = new Map<string, number>();
    for (const slug of uniqueSlugs) {
      const count = json.data[`repo${slug.id}`]?.stargazerCount;
      if (typeof count === "number") {
        starsMap.set(slug.slug, count);
      }
    }

    // Mutate in-place
    for (const r of resources) {
      r.stars = starsMap.get(r.slug);
    }

    // sort by star coun (descending) in place
    resources.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  } catch (_) {
    console.log(_);

    if (process.env.NODE_ENV === "production") {
      throw new Error("Failed to fetch GitHub stars");
    }
  }
}
