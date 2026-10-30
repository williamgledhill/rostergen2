/**
 * The password policy, shared by the server (which enforces it) and the forms
 * (which show it as the person types). Applies whenever a password is set;
 * existing passwords keep working until they are next changed.
 */

export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_RULES = [
  {
    id: "length",
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (password: string) => password.trim().length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: "uppercase",
    label: "At least one capital letter",
    test: (password: string) => /\p{Lu}/u.test(password),
  },
  {
    id: "special",
    label: "At least one special character, like ! ? # or @",
    // Anything that isn't a letter, a number or a space.
    test: (password: string) => /[^\p{L}\p{N}\s]/u.test(password),
  },
] as const;

export const PASSWORD_POLICY_MESSAGE = `Use at least ${MIN_PASSWORD_LENGTH} characters, including a capital letter and a special character.`;

export function checkPasswordRules(password: string) {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(password) }));
}

export function meetsPasswordPolicy(password: string) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
