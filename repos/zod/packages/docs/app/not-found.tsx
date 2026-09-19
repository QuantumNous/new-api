import { layoutProps } from "@/app/(doc)/layout";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsPage } from "fumadocs-ui/page";

export const metadata = { title: "Page not found | Zod" };

export default function NotFound() {
  return (
    <DocsLayout {...layoutProps} containerProps={{}}>
      <DocsPage>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h1 className="text-6xl font-bold text-fd-foreground border-none py-0!">404</h1>
          <p className="mt-4 text-lg text-fd-muted-foreground">This page could not be found.</p>
        </div>
      </DocsPage>
    </DocsLayout>
  );
}
