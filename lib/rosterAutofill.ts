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

export type AutofillPlacementWindow = {
  startRow: number;
  endRow: number;
};

export type AutofillOccupiedRange = {
  startRow: number;
  span: number;
};

function overlapsRange(range: AutofillOccupiedRange, startRow: number, span: number) {
  return startRow < range.startRow + range.span && startRow + span > range.startRow;
}

export function getFeasiblePlacementRows(input: {
  candidateRows: number[];
  span: number;
  employeeWindow?: AutofillPlacementWindow | null;
  occupiedRanges?: AutofillOccupiedRange[];
  blockedRange?: AutofillOccupiedRange | null;
}) {
  if (!Number.isFinite(input.span) || input.span <= 0) return [];

  const occupiedRanges = input.occupiedRanges ?? [];

  return input.candidateRows.filter((row) => {
    if (!Number.isFinite(row)) return false;

    const endRow = row + input.span;
    if (input.employeeWindow) {
      if (row < input.employeeWindow.startRow || endRow > input.employeeWindow.endRow) {
        return false;
      }
    }

    if (input.blockedRange && overlapsRange(input.blockedRange, row, input.span)) {
      return false;
    }

    return !occupiedRanges.some((range) => overlapsRange(range, row, input.span));
  });
}

function summarizeFutureAvailability(counts: number[]) {
  return {
    blockedTemplates: counts.filter((count) => count <= 0).length,
    tightestTemplate: counts.length ? Math.min(...counts) : Number.POSITIVE_INFINITY,
    totalOptions: counts.reduce((sum, count) => sum + Math.max(0, count), 0),
  };
}

export function compareFutureMinimumAvailability(aCounts: number[], bCounts: number[]) {
  const a = summarizeFutureAvailability(aCounts);
  const b = summarizeFutureAvailability(bCounts);

  if (a.blockedTemplates !== b.blockedTemplates) {
    return a.blockedTemplates - b.blockedTemplates;
  }
  if (a.tightestTemplate !== b.tightestTemplate) {
    return b.tightestTemplate - a.tightestTemplate;
  }
  if (a.totalOptions !== b.totalOptions) {
    return b.totalOptions - a.totalOptions;
  }
  return 0;
}
