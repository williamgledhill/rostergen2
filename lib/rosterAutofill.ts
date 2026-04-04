export function getAutofillTemplatePriority(input: {
  mustManned: boolean;
  hasFixedTimes: boolean;
  minPerEmp: number;
}) {
  if (input.mustManned && input.hasFixedTimes) return 5;
  if (input.hasFixedTimes) return 4;
  if (input.mustManned) return 3;
  if (input.minPerEmp > 0) return 2;
  return 1;
}

export function getPreferredConcurrentLimit(
  configuredLimit: number,
  options?: { preferSolo?: boolean }
) {
  if (!options?.preferSolo) return configuredLimit;
  if (!Number.isFinite(configuredLimit) || configuredLimit > 1) return 1;
  return configuredLimit;
}
