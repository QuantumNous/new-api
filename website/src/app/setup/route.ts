import { redirectToConsoleSetup } from "../setup-redirect";

export function GET(request: Request) {
  return redirectToConsoleSetup(request);
}
