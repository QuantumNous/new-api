import { Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-10 text-stone-900 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)] dark:text-stone-100">
                <section className="w-full max-w-md text-center">
                    <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-lg border border-stone-200 bg-white text-2xl font-semibold shadow-sm dark:border-stone-800 dark:bg-stone-900">404</div>
                    <h1 className="text-3xl font-semibold tracking-normal">页面不存在</h1>
                    <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">这个地址没有对应的页面，可能已经移动或被合并到其他入口。</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-200">
                            <Home className="size-4" />
                            返回首页
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
