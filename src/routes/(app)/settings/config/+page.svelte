<script lang="ts">
	import { page } from '$app/state';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { del, get, put } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg } from '#lib/utils/errors';
	import type { EffectiveSetting } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	const qc = useQueryClient();

	const root = $derived(data.units.find((u) => u.type === 'company') ?? data.units[0]);
	let picked = $state<string | undefined>(page.url.searchParams.get('unit') ?? undefined);
	const unitId = $derived(picked ?? scope.selected?.id ?? root?.id);
	const unit = $derived(data.units.find((u) => u.id === unitId));
	const canEdit = $derived(!!unit && can(data.me.grants, 'settings.manage', unit.path));

	const q = createQuery(() => ({
		queryKey: ['settings', unitId],
		enabled: !!unitId,
		queryFn: async () => (await get<EffectiveSetting[]>('/settings/effective', { org_unit_id: unitId })).data
	}));

	const groups = $derived.by(() => {
		const m = new Map<string, EffectiveSetting[]>();
		for (const s of q.data ?? []) m.set(s.group, [...(m.get(s.group) ?? []), s]);
		return [...m];
	});

	let editing = $state<string | null>(null);
	let draft = $state('');

	const show = (s: EffectiveSetting) => (Array.isArray(s.value) ? s.value.join(', ') : typeof s.value === 'boolean' ? (s.value ? 'Ya' : 'Tidak') : String(s.value ?? ''));
	function begin(s: EffectiveSetting) {
		editing = s.key;
		draft = Array.isArray(s.value) ? s.value.join(', ') : String(s.value ?? '');
	}
	function parse(s: EffectiveSetting): unknown {
		switch (s.type) {
			case 'int':
			case 'number':
				return Number(draft);
			case 'bool':
				return draft === 'true';
			case 'string_array':
				return draft.split(',').map((x) => x.trim()).filter(Boolean);
			default:
				return draft;
		}
	}
	const refresh = () => qc.invalidateQueries({ queryKey: ['settings', unitId] });

	const save = createMutation(() => ({
		mutationFn: (s: EffectiveSetting) => put('/settings', { org_unit_id: unitId, key: s.key, value: parse(s) }),
		onSuccess: async () => { toast.ok('Pengaturan disimpan'); editing = null; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const revert = createMutation(() => ({
		mutationFn: (key: string) => del('/settings', { org_unit_id: unitId, key }),
		onSuccess: async () => { toast.ok('Kembali ke nilai turunan'); await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const sourceLabel = (s: EffectiveSetting) => (s.source === 'default' ? 'Bawaan sistem' : s.inherited ? `Turunan dari ${s.source_name}` : `Diatur di sini`);
</script>

<PageHeader title="Konfigurasi" description="Nilai diwariskan: perusahaan → region → toko. Yang lebih spesifik menang." />

<div class="mb-4 max-w-sm">
	<label class="mb-1 block text-[13px] font-medium" for="unit">Lokasi</label>
	<Select id="unit" value={unitId} onchange={(e) => (picked = e.currentTarget.value)}>
		{#each data.units.filter((u) => u.accessible) as u (u.id)}
			<option value={u.id}>{' '.repeat(u.path.split('.').length - 1)}{u.name}</option>
		{/each}
	</Select>
</div>

{#if q.isPending}
	<p class="text-muted">Memuat…</p>
{:else if q.isError}
	<p class="text-danger">{q.error.message}</p>
{:else}
	<div class="space-y-5">
		{#each groups as [group, items] (group)}
			<Card>
				<h2 class="border-b border-border px-4 py-2.5 text-[12px] font-semibold tracking-wide text-muted uppercase">{group}</h2>
				<div class="divide-y divide-border">
					{#each items as s (s.key)}
						<div class="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3">
							<div class="min-w-0">
								<p class="font-medium">{s.description}</p>
								<p class="font-mono text-[12px] text-muted">{s.key}</p>
							</div>
							<div class="flex items-center gap-3">
								{#if editing === s.key}
									{#if s.type === 'bool'}
										<Select class="w-28" bind:value={draft}><option value="true">Ya</option><option value="false">Tidak</option></Select>
									{:else}
										<Input class="w-72" bind:value={draft} type={s.type === 'int' || s.type === 'number' ? 'number' : 'text'} />
									{/if}
									<Button size="sm" loading={save.isPending} onclick={() => save.mutate(s)}>Simpan</Button>
									<Button size="sm" variant="ghost" onclick={() => (editing = null)}>Batal</Button>
								{:else}
									<span class="num max-w-xs truncate text-right">{show(s) || '—'}</span>
									<Badge tone={s.source === 'default' ? 'neutral' : s.inherited ? 'info' : 'ok'}>{sourceLabel(s)}</Badge>
									{#if canEdit}
										<Button size="sm" variant="secondary" onclick={() => begin(s)}>Ubah</Button>
										{#if s.source !== 'default' && !s.inherited}
											<Button size="sm" variant="ghost" loading={revert.isPending} onclick={() => revert.mutate(s.key)}>Reset</Button>
										{/if}
									{/if}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/each}
	</div>
{/if}
