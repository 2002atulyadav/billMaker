import type { TKey, Translator, Vars } from '@/i18n';

/** An error meant for the user, carrying a translation key so screens can show it in their language. */
export class AppError extends Error {
  constructor(
    readonly key: TKey,
    readonly vars?: Vars,
  ) {
    super(key);
    this.name = 'AppError';
  }
}

export function errorText(t: Translator['t'], err: unknown): string {
  if (err instanceof AppError) return t(err.key, err.vars);
  return err instanceof Error ? err.message : String(err);
}
