<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import type { OrgUnit, Role } from '#lib/types/api';

	export interface Row {
		role_id: string;
		org_unit_id: string; // '' = seluruh perusahaan
	}
	let { rows = $bindable(), roles, units }: { rows: Row[]; roles: Role[]; units: OrgUnit[] } = $props();
	const scopeUnits = $derived(units.filter((u) => u.type !== 'company' && u.accessible));
</script>

<div class="space-y-2">
	{#each rows as row, i}
		<div class="flex items-center gap-2">
			<Select class="flex-1" bind:value={row.role_id} aria-label="Role">
				<option value="">Pilih role…</option>
				{#each roles as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
			</Select>
			<span class="text-muted">di</span>
			<Select class="flex-1" bind:value={row.org_unit_id} aria-label="Lingkup">
				<option value="">Seluruh perusahaan</option>
				{#each scopeUnits as u (u.id)}<option value={u.id}>{u.name} ({u.type === 'store' ? 'toko' : 'region'})</option>{/each}
			</Select>
			<button class="rounded p-2 text-muted hover:bg-surface-2 hover:text-danger" aria-label="Hapus" onclick={() => rows.splice(i, 1)}><Trash2 class="size-4" /></button>
		</div>
	{/each}
	<Button size="sm" variant="secondary" onclick={() => rows.push({ role_id: '', org_unit_id: '' })}><Plus class="size-3.5" />Tambah akses</Button>
</div>
