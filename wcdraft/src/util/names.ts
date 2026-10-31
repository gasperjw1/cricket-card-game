/** Name helpers shared by the data pipeline and the browser client; nothing here touches the file system. */

/** "RG Sharma" → initials "RG", surname "Sharma"; "Yuvraj Singh" has no initials. */
export function splitShortName(short: string): { initials: string; surname: string } {
  const [first = "", ...rest] = short.trim().split(/\s+/);
  return rest.length && /^[A-Z]{1,6}$/.test(first) ? { initials: first, surname: rest.join(" ") } : { initials: "", surname: short.trim() };
}

/** Default display name: first given name + Cricsheet surname, when the legal name fits the initials. */
export function deriveDisplayName(short: string, legal: string): string {
  const { initials, surname } = splitShortName(short);
  if (!initials) return short.trim();
  const given = legal.trim().split(/\s+/)[0] ?? "";
  if (!given || given[0]?.toUpperCase() !== initials[0]) return short.trim();
  const title = given === given.toUpperCase() ? given[0] + given.slice(1).toLowerCase() : given;
  return `${title} ${surname}`;
}
