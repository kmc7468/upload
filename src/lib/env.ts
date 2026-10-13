// A misconfigured limit must stop the server instead of silently becoming NaN.
export const positiveInteger = (name: string, value: string | undefined, fallback: number) => {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, but is "${value}".`);
  }
  return parsed;
};
