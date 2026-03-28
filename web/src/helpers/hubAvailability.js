export function buildRouteManagerHubAvailabilitySignature(hubStatus = null) {
  return `${hubStatus?.configured ? '1' : '0'}:${hubStatus?.reachable ? '1' : '0'}`;
}

export function hasRouteManagerHubAvailabilityChanged(
  previousHubStatus = null,
  nextHubStatus = null,
) {
  return (
    buildRouteManagerHubAvailabilitySignature(previousHubStatus) !==
    buildRouteManagerHubAvailabilitySignature(nextHubStatus)
  );
}
