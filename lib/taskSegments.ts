export const SLOT_MINUTES = 15;

export type TaskSegmentRows = {
  waitingRows: number;
  mainRows: number;
  packingRows: number;
};

/**
 * Splits a task's rows into its "waiting for" lead-in, main body and "packing up"
 * tail. The main body always keeps at least one row, so buffers are trimmed to fit.
 */
export function getTaskSegmentRows(task: {
  span: number;
  waitingMinutes?: number;
  packingMinutes?: number;
}): TaskSegmentRows {
  const totalRows = Math.max(1, task.span);
  const waitingRows = Math.max(0, Math.round((task.waitingMinutes ?? 0) / SLOT_MINUTES));
  const packingRows = Math.max(0, Math.round((task.packingMinutes ?? 0) / SLOT_MINUTES));
  const safeWaiting = Math.min(waitingRows, totalRows - 1);
  const safePacking = Math.min(packingRows, totalRows - safeWaiting - 1);
  const mainRows = Math.max(1, totalRows - safeWaiting - safePacking);
  return { waitingRows: safeWaiting, mainRows, packingRows: safePacking };
}
