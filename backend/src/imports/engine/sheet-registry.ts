import type {
  ImportSheetHandler,
  SheetId,
} from './import-sheet-handler.interface';

/**
 * DI token under which the engine registers the array of entity handlers. The
 * module provider aggregates the per-entity handlers in the next slice; the
 * registry is a plain, instantiable class so it stays unit-testable without a
 * Nest testing module.
 */
export const IMPORT_SHEET_HANDLERS = 'IMPORT_SHEET_HANDLERS';

/**
 * Resolves a per-entity {@link ImportSheetHandler} by its {@link SheetId}.
 *
 * The handlers are provided as a DI array — one handler per importable sheet —
 * and this registry indexes them so the orchestrator can look up the correct
 * handler for a detected sheet without a switch statement.
 */
export class SheetRegistry {
  private readonly bySheetId: Map<SheetId, ImportSheetHandler>;

  constructor(handlers: readonly ImportSheetHandler[]) {
    this.bySheetId = new Map(
      handlers.map((handler) => [handler.sheetId, handler]),
    );
  }

  /** Returns the handler registered for `sheetId`, or `undefined` when unregistered. */
  get(sheetId: SheetId): ImportSheetHandler | undefined {
    return this.bySheetId.get(sheetId);
  }

  /** Returns every registered entity handler, in registration order. */
  all(): readonly ImportSheetHandler[] {
    return [...this.bySheetId.values()];
  }
}
