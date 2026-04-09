/**
 * blocked_domains column stores JSON.stringify(string[]) e.g. ["@gmail.com"].
 */
export function parseBlockedDomainsFromStorage(
  raw: string | null | undefined,
): string[] {
  if (raw == null) return [];
  const t = String(raw).trim();
  if (!t) return [];
  try {
    const p = JSON.parse(t) as unknown;
    if (Array.isArray(p)) {
      return p.map((x) => String(x).toLowerCase());
    }
  } catch {
    /* plain string */
  }
  return [t.toLowerCase()];
}

export function isGuestEmailDomainBlocked(
  email: string,
  accessSpecifier: string | null | undefined,
  blockedDomainsRaw: string | null | undefined,
): boolean {
  if (accessSpecifier !== 'block_domains' || !email?.trim()) {
    return false;
  }
  const list = parseBlockedDomainsFromStorage(blockedDomainsRaw);
  if (list.length === 0) return false;
  const at = email.indexOf('@');
  if (at === -1) return false;
  const emailDomain = email.slice(at).toLowerCase();
  return list.some((d) => {
    const norm = d.startsWith('@') ? d : `@${d}`;
    return emailDomain === norm;
  });
}
