export function validCorporateCallback(value: string, configuredOrigin: string | undefined): boolean {
  if (!configuredOrigin) return false;
  try {
    const expected = new URL(configuredOrigin);
    const actual = new URL(value);
    return expected.protocol === "https:" && expected.pathname === "/" &&
      !expected.username && !expected.password && !expected.search && !expected.hash &&
      actual.origin === expected.origin && actual.pathname === "/auth/complete" &&
      !actual.username && !actual.password && !actual.hash;
  } catch { return false; }
}
