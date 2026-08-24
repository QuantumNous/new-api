# Recall Group Filter Interaction Design

## Goal

Prevent operators from entering a user group when the recall campaign is configured not to filter by group.

## Design

- Keep the group input visible so the relationship between the input and mode remains clear and the form layout stays stable.
- Disable the group input whenever `group_mode` is empty (`No group filter`) or the campaign is immutable.
- When the operator switches to `No group filter`, immediately normalize the form to `group_mode: ''` and `groups: []`.
- Switching to `Allow groups` or `Block groups` enables an empty group input; previously cleared values are not restored.
- Do not change the API payload shape, schema, or backend audience semantics.

## Validation

- A pure normalization test proves that `No group filter` clears groups while allow/block modes preserve them.
- Static editor tests prove the input remains visible and is disabled only for no-filter or immutable states.
- Existing schema and backend tests continue to reject inconsistent mode/group pairs.

