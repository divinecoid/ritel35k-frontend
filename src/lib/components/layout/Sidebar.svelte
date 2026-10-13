<script lang="ts">
	import { page } from '$app/state';
	import { LayoutDashboard, Package, Truck, Store, Network, SlidersHorizontal, Users, ShieldCheck, ScrollText, Tags, MonitorSmartphone, Receipt, Warehouse, Clock, ShoppingCart, ArrowLeftRight, ClipboardCheck, UserRound, BadgePercent, Ticket, Tag, BarChart3, Bell, CheckSquare, ShieldAlert, Radio } from '@lucide/svelte';
	import { can } from '#lib/permissions';
	import type { Me } from '#lib/types/api';

	let { me }: { me: Me } = $props();

	const sections = [
		{
			title: null,
			items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: null }]
		},
		{
			title: 'Manajemen',
			items: [
				{ href: '/reports', label: 'Laporan', icon: BarChart3, perm: null, anyPerm: ['report.sales.view', 'report.inventory.view'] },
				{ href: '/approvals', label: 'Persetujuan', icon: CheckSquare, perm: null, anyPerm: ['purchase_order.approve', 'inventory.transfer.approve', 'inventory.count.approve'] },
				{ href: '/notifications', label: 'Notifikasi', icon: Bell, perm: null, anyPerm: ['report.sales.view', 'purchase_order.create', 'inventory.transfer.approve'] }
			]
		},
		{
			title: 'Operasional',
			items: [
				{ href: '/pos', label: 'Buka kasir (POS)', icon: MonitorSmartphone, perm: 'pos.transaction.create', external: true },
				{ href: '/sales', label: 'Penjualan', icon: Receipt, perm: 'pos.sale.view' },
				{ href: '/shifts', label: 'Shift kasir', icon: Clock, perm: 'pos.sale.view' },
				{ href: '/inventory', label: 'Inventori', icon: Warehouse, perm: 'inventory.view' }
			]
		},
		{
			title: 'Rantai pasok',
			items: [
				{ href: '/purchasing', label: 'Pembelian', icon: ShoppingCart, perm: 'purchase_order.view' },
				{ href: '/transfers', label: 'Transfer stok', icon: ArrowLeftRight, perm: 'inventory.transfer' },
				{ href: '/stock-counts', label: 'Stok opname', icon: ClipboardCheck, perm: 'inventory.count' }
			]
		},
		{
			title: 'Komersial',
			items: [
				{ href: '/customers', label: 'Pelanggan & member', icon: UserRound, perm: 'customer.view' },
				{ href: '/promotions', label: 'Promosi', icon: BadgePercent, perm: 'promotion.manage' },
				{ href: '/vouchers', label: 'Voucher', icon: Ticket, perm: 'promotion.manage' },
				{ href: '/pricing', label: 'Daftar harga', icon: Tag, perm: 'pricing.view' }
			]
		},
		{
			title: 'Keamanan',
			items: [
				{ href: '/security', label: 'Loss prevention', icon: ShieldAlert, perm: 'security.view' },
				{ href: '/rfid', label: 'RFID', icon: Radio, perm: 'rfid.view' }
			]
		},
		{
			title: 'Master data',
			items: [
				{ href: '/products', label: 'Produk', icon: Package, perm: 'product.view' },
				{ href: '/products/master', label: 'Kategori & merek', icon: Tags, perm: 'product.view' },
				{ href: '/suppliers', label: 'Supplier', icon: Truck, perm: 'supplier.view' }
			]
		},
		{
			title: 'Organisasi',
			items: [
				{ href: '/settings/stores', label: 'Toko', icon: Store, perm: 'organization.view' },
				{ href: '/settings/organization', label: 'Struktur', icon: Network, perm: 'organization.view' },
				{ href: '/settings/terminals', label: 'Terminal POS', icon: MonitorSmartphone, perm: 'pos.terminal.manage' },
				{ href: '/settings/config', label: 'Konfigurasi', icon: SlidersHorizontal, perm: 'settings.view' }
			]
		},
		{
			title: 'Akses',
			items: [
				{ href: '/settings/users', label: 'Pengguna', icon: Users, perm: 'user.view' },
				{ href: '/settings/roles', label: 'Role', icon: ShieldCheck, perm: 'role.view' },
				{ href: '/audit', label: 'Audit log', icon: ScrollText, perm: 'audit.view' }
			]
		}
	];

	const visible = $derived(
		sections
			.map((s) => ({ ...s, items: s.items.filter((i) => ('anyPerm' in i && i.anyPerm ? i.anyPerm.some((p) => can(me.grants, p)) : !i.perm || can(me.grants, i.perm))) }))
			.filter((s) => s.items.length)
	);
	const active = (href: string) => page.url.pathname === href || (href !== '/products' && page.url.pathname.startsWith(href + '/')) || (href === '/products' && page.url.pathname === '/products');
</script>

<nav class="flex w-56 shrink-0 flex-col gap-4 border-r border-border bg-surface px-3 py-4" aria-label="Menu utama">
	<a href="/dashboard" class="px-2 text-base font-bold tracking-tight">RITEL<span class="text-primary">35K</span></a>
	{#each visible as s}
		<div class="space-y-0.5">
			{#if s.title}<p class="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{s.title}</p>{/if}
			{#each s.items as i (i.href)}
				<a
					href={i.href}
					data-sveltekit-reload={'external' in i ? '' : undefined}
					aria-current={active(i.href) ? 'page' : undefined}
					class="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2 aria-[current=page]:bg-primary/12 aria-[current=page]:font-medium aria-[current=page]:text-primary"
				>
					<i.icon class="size-4" aria-hidden="true" />
					{i.label}
				</a>
			{/each}
		</div>
	{/each}
</nav>
