import { ScrollArea } from '@base-ui/react/scroll-area';

export default function ExampleScrollAreaScrollFade() {
  return (
    <ScrollArea.Root className="h-48 w-96 max-w-[calc(100vw-8rem)] bg-neutral-100 dark:bg-neutral-800 has-[>_:first-child:focus-visible]:outline-2 has-[>_:first-child:focus-visible]:outline-offset-0 has-[>_:first-child:focus-visible]:outline-neutral-950 dark:has-[>_:first-child:focus-visible]:outline-white">
      <ScrollArea.Viewport className="h-full bg-neutral-100 dark:bg-neutral-800 outline-none mask-linear-[to_bottom,transparent_0,black_min(40px,var(--scroll-area-overflow-y-start)),black_calc(100%_-_min(40px,var(--scroll-area-overflow-y-end,40px))),transparent_100%] mask-no-repeat">
        <ScrollArea.Content className="flex flex-col gap-4 py-2 pr-5 pl-3 text-sm leading-[1.375rem] text-neutral-950 dark:text-white">
          <p>
            Vernacular architecture is building done outside any academic tradition, and without
            professional guidance. It is not a particular architectural movement or style, but
            rather a broad category, encompassing a wide range and variety of building types, with
            differing methods of construction, from around the world, both historical and extant and
            classical and modern. Vernacular architecture constitutes 95% of the world's built
            environment, as estimated in 1995 by Amos Rapoport, as measured against the small
            percentage of new buildings every year designed by architects and built by engineers.
          </p>
          <p>
            This type of architecture usually serves immediate, local needs, is constrained by the
            materials available in its particular region and reflects local traditions and cultural
            practices. The study of vernacular architecture does not examine formally schooled
            architects, but instead that of the design skills and tradition of local builders, who
            were rarely given any attribution for the work. More recently, vernacular architecture
            has been examined by designers and the building industry in an effort to be more energy
            conscious with contemporary design and construction—part of a broader interest in
            sustainable design.
          </p>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className="m-px flex w-4 justify-center bg-black/8 dark:bg-white/12 opacity-0 transition-opacity duration-150 pointer-events-none data-hovering:opacity-100 data-hovering:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0 data-scrolling:pointer-events-auto">
        <ScrollArea.Thumb className="w-full bg-neutral-950 dark:bg-white" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
