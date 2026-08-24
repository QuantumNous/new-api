import { redirectToGoogleSignIn } from "../sign-in-redirect";

export function GET(request: Request) {
  return redirectToGoogleSignIn(request);
}
