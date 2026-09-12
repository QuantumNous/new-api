export interface ContentProps {
  readonly children: React.ReactNode
}

export const Content: React.FunctionComponent<ContentProps> = ({
  children,
}) => {
  return <section className="my-2 flex flex-col gap-2">{children}</section>
}
