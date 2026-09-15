import { blog } from "@/loaders/source";
import Link from "next/link";

export const revalidate = false;

export default function BlogIndexPage() {
  const posts = blog.getPages() as any[];

  return (
    <main className="grow container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">Blog</h1>
        <p className="text-fd-muted-foreground mb-10">Updates, announcements, and deep dives from the Zod project.</p>
      </div>
      <div className="mx-auto max-w-3xl grid gap-6">
        {posts.map((post) => {
          const title = post.data.title ?? post.slugs.join("/") ?? "Untitled";
          const description = post.data.description ?? "";
          const dateValue = post.data?.date as string | Date | undefined;
          const formattedDate = dateValue
            ? new Date(dateValue).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : undefined;
          return (
            <Link
              key={post.url}
              href={post.url}
              className="block rounded-xl border p-6 hover:shadow-md transition-shadow bg-fd-secondary/30"
            >
              <h2 className="text-2xl font-semibold mb-2">{title}</h2>
              {description ? <p className="mb-2 text-fd-muted-foreground">{description}</p> : null}
              {formattedDate ? <p className="text-sm text-fd-muted-foreground">{formattedDate}</p> : null}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
