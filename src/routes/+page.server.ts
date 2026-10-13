import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

// The same URL serves curl the usage text, so the redirect must not be cached as permanent.
export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ Vary: "Accept" });
  redirect(302, "/app");
};
