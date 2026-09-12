import { useLang } from '@rspress/core/runtime';
import { containerStyle } from '@rstack-dev/doc-ui/section-style';
import { ToolStack as BaseToolStack } from '@rstack-dev/doc-ui/tool-stack';

export function ToolStack() {
  const lang = useLang();
  return (
    <section className={containerStyle}>
      <BaseToolStack lang={lang} />
    </section>
  );
}
