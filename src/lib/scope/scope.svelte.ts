import { getContext, setContext } from 'svelte';
import type { OrgUnit } from '#lib/types/api';

const KEY = Symbol('scope');
const STORAGE = 'r35k_scope_v1';

/**
 * The global Company → Region → Store filter. The unit list comes from the API (/organization/scope-tree),
 * already limited to what the signed-in user may see — there is no static store list anywhere.
 * Every dashboard/report passes `path` (an ltree prefix) to the API; "All stores" = no narrowing
 * beyond the user's own scope.
 */
export class ScopeState {
	units = $state<OrgUnit[]>([]);
	regionId = $state('all');
	storeId = $state('all');

	constructor(units: OrgUnit[]) {
		this.units = units;
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
			if (saved) {
				this.regionId = saved.regionId ?? 'all';
				this.storeId = saved.storeId ?? 'all';
			}
		} catch {
			/* storage unavailable: start unfiltered */
		}
		this.sanitize();
	}

	update(units: OrgUnit[]) {
		this.units = units;
		this.sanitize();
	}

	private sanitize() {
		if (this.regionId !== 'all' && !this.regions.some((u) => u.id === this.regionId)) this.regionId = 'all';
		if (this.storeId !== 'all' && !this.stores.some((u) => u.id === this.storeId)) this.storeId = 'all';
	}

	private persist() {
		try {
			localStorage.setItem(STORAGE, JSON.stringify({ regionId: this.regionId, storeId: this.storeId }));
		} catch {
			/* ignore */
		}
	}

	/** Intermediate levels (business units, regions) in tree order. */
	regions = $derived(this.units.filter((u) => u.type === 'region' || u.type === 'business_unit'));

	private regionUnit = $derived(this.units.find((u) => u.id === this.regionId));

	/** Accessible stores under the chosen region. */
	stores = $derived(
		this.units.filter(
			(u) => u.type === 'store' && u.accessible && (!this.regionUnit || u.path.startsWith(this.regionUnit.path + '.'))
		)
	);

	selected = $derived(
		this.storeId !== 'all' ? this.units.find((u) => u.id === this.storeId) : this.regionUnit
	);

	/** ltree prefix to filter by; undefined = everything the user can access. */
	path = $derived(this.selected?.path);

	/** Store ids currently in view. */
	storeIds = $derived(this.stores.filter((s) => this.storeId === 'all' || s.id === this.storeId).map((s) => s.store_id!));

	label = $derived(this.selected ? this.selected.name : 'Semua toko');

	setRegion(id: string) {
		this.regionId = id;
		this.storeId = 'all';
		this.persist();
	}
	setStore(id: string) {
		this.storeId = id;
		this.persist();
	}

	unitName(id: string | null | undefined) {
		return id ? (this.units.find((u) => u.id === id)?.name ?? '—') : '—';
	}
}

export const provideScope = (s: ScopeState) => setContext(KEY, s);
export const useScope = () => getContext<ScopeState>(KEY);
