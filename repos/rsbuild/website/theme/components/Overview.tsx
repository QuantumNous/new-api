import { type Group, OverviewGroup } from '@theme';
import { useI18nUrl } from './utils';

declare const OVERVIEW_GROUPS: Group[];

export type { Group };

export default function Overview() {
  const tUrl = useI18nUrl();

  const group: Group = {
    name: '',
    items: OVERVIEW_GROUPS.map((item) => ({
      text: item.name,
      link: '',
      items: item.items.map(({ link, text }) => {
        return {
          link: tUrl(link),
          text,
        };
      }),
    })),
  };

  return <OverviewGroup group={group} />;
}
