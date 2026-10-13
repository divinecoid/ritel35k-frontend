import type { GrantScope } from '#lib/types/api';

type Grants = Record<string, GrantScope>;

const within = (path: string, scope: string) => path === scope || path.startsWith(scope + '.');

/**
 * Mirrors backend access.Grants.Can. Without `orgPath`, answers "does the user hold this permission
 * anywhere?" (use for showing menu items). With it, "...over this part of the org tree?".
 * UI hiding is a convenience only — the API enforces every check.
 */
export function can(grants: Grants, perm: string, orgPath?: string): boolean {
	const g = grants[perm];
	if (!g) return false;
	if (g.all) return true;
	if (orgPath === undefined) return g.paths.length > 0;
	return g.paths.some((p) => within(orgPath, p));
}

/** Company-wide only (global master data such as products and suppliers). */
export const canAll = (grants: Grants, perm: string) => !!grants[perm]?.all;

/** Like `can`, for documents whose location may be a central warehouse: path "" means company-wide only. */
export const canAtPath = (grants: Grants, perm: string, path: string) => (path === '' ? canAll(grants, perm) : can(grants, perm, path));
