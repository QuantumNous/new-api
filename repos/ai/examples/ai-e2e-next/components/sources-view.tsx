import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from './ai-elements/sources';
import type { SourceUrlUIPart } from 'ai';

const SourcesView = ({ sources }: { sources: SourceUrlUIPart[] }) => {
  if (sources.length === 0) {
    return null;
  }

  return (
    <Sources>
      <SourcesTrigger count={sources.length} />
      <SourcesContent>
        {sources.map((source, index) => (
          <Source key={index} href={source.url} title={source.title} />
        ))}
      </SourcesContent>
    </Sources>
  );
};

export default SourcesView;
