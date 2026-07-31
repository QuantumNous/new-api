import { redirectToConsoleSetup } from "@/app/setup-redirect";

export function GET(request: Request) {
  return redirectToConsoleSetup(request);
}
