import convertToArrayPayload from '../utils/convertToArrayPayload';

export default <T extends string | readonly string[] | undefined>(
  name?: T,
  signalName?: string,
  exact?: boolean,
) =>
  !name ||
  !signalName ||
  name === signalName ||
  convertToArrayPayload(name).some(
    (currentName) =>
      currentName &&
      (exact
        ? currentName === signalName
        : currentName.startsWith(signalName) ||
          signalName.startsWith(currentName)),
  );
