import { expectType } from '#test-utils';
import { Collapsible } from '@base-ui/react/collapsible';
import type {
  CollapsiblePanelProps,
  CollapsiblePanelState,
  CollapsibleRootChangeEventDetails,
  CollapsibleRootChangeEventReason,
  CollapsibleRootProps,
  CollapsibleRootState,
  CollapsibleTriggerProps,
  CollapsibleTriggerState,
} from '@base-ui/react/collapsible';

const rootProps = {} as Collapsible.Root.Props;
const triggerProps = {} as Collapsible.Trigger.Props;
const panelProps = {} as Collapsible.Panel.Props;
const rootState = {} as Collapsible.Root.State;
const triggerState = {} as Collapsible.Trigger.State;
const panelState = {} as Collapsible.Panel.State;

expectType<CollapsibleRootProps, typeof rootProps>(rootProps);
expectType<CollapsibleTriggerProps, typeof triggerProps>(triggerProps);
expectType<CollapsiblePanelProps, typeof panelProps>(panelProps);
expectType<CollapsibleRootState, typeof rootState>(rootState);
expectType<CollapsibleTriggerState, typeof triggerState>(triggerState);
expectType<CollapsiblePanelState, typeof panelState>(panelState);

const handleOpenChange: NonNullable<Collapsible.Root.Props['onOpenChange']> = (
  open,
  eventDetails,
) => {
  expectType<boolean, typeof open>(open);
  expectType<CollapsibleRootChangeEventDetails, typeof eventDetails>(eventDetails);
};

const changeReason = null as unknown as Collapsible.Root.ChangeEventReason;
const changeDetails = null as unknown as Collapsible.Root.ChangeEventDetails;

expectType<CollapsibleRootChangeEventReason, typeof changeReason>(changeReason);
expectType<CollapsibleRootChangeEventDetails, typeof changeDetails>(changeDetails);

<Collapsible.Root onOpenChange={handleOpenChange}>
  <Collapsible.Trigger />
  <Collapsible.Panel />
</Collapsible.Root>;
