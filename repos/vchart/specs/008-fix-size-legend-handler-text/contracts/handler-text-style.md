# Contract: Continuous Legend Handler Text Style

## Public Configuration Contract

The `handlerText.style` field on continuous legends must accept:

- A static text style object.
- A callback receiving continuous legend item context and returning a text style object.

## Behavioral Guarantees

- Static style values remain backward compatible.
- Callback return values are transformed with the same graphic conversion rules as static styles.
- Missing or partial callback return objects do not prevent handler text rendering.
