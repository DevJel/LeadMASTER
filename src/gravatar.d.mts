export function normalizeGravatarEmail(email: unknown): string;
export function createGravatarHash(email: unknown): Promise<string | null>;
export function createGravatarAvatarUrl(email: unknown, size?: number): Promise<string | null>;
