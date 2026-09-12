import { expectType } from '#test-utils';
import { PreviewCard } from '@base-ui/react/preview-card';

const numberPayloadHandle = PreviewCard.createHandle<number>();

const rootWithDirectChildren = (
  <PreviewCard.Root handle={numberPayloadHandle}>
    <PreviewCard.Portal />
  </PreviewCard.Root>
);

const rootWithFunctionChildren = (
  <PreviewCard.Root handle={numberPayloadHandle}>
    {({ payload }) => {
      expectType<number | undefined, typeof payload>(payload);
      return null;
    }}
  </PreviewCard.Root>
);

const triggerWithPayload = <PreviewCard.Trigger handle={numberPayloadHandle} payload={42} />;
const triggerWithoutPayload = <PreviewCard.Trigger handle={numberPayloadHandle} />;

const triggerWithInvalidPayload = (
  // @ts-expect-error
  <PreviewCard.Trigger handle={numberPayloadHandle} payload={'invalid'} />
);
