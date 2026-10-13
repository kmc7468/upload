import { browser } from "$app/environment";

// The current time, refreshed often enough for countdowns such as "Expires in 5 minutes".
let now = $state(Date.now());

if (browser) {
  setInterval(() => (now = Date.now()), 30_000);
}

// The server shares this module among all requests and never ticks, so it reads the time
// afresh for every page it renders.
export const clock = {
  get now() {
    return browser ? now : Date.now();
  },
};
