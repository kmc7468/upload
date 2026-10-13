// The current time, refreshed often enough for countdowns such as "Expires in 5 minutes".
export const clock = $state({ now: Date.now() });

if (typeof window !== "undefined") {
  setInterval(() => (clock.now = Date.now()), 30_000);
}
