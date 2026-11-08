/** Display helpers shared by the signed-in workspace. */

/** Formats a US E.164 number (+14155550123) as "(415) 555-0123"; other values are returned unchanged. */
export function formatPhone(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164.trim());
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

/** True when the value looks like a person's name rather than a phone number or email address. */
export function isPersonName(name: string | null | undefined): name is string {
  const value = name?.trim() ?? "";
  return value !== "" && !/^[+\d(]/.test(value) && !value.includes("@") && value !== "Your account";
}
