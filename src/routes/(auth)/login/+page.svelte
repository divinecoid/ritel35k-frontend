<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';

	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Masuk — RITEL35K</title></svelte:head>

<div class="grid min-h-screen place-items-center px-4">
	<div class="w-full max-w-sm space-y-6">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">RITEL<span class="text-primary">35K</span></h1>
			<p class="text-muted">Retail Store Operating System</p>
		</div>
		<form
			method="POST"
			class="space-y-4 rounded-lg border border-border bg-surface p-6"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<Field label="Email" for="email"><Input id="email" name="email" type="email" autocomplete="username" value={form?.email ?? ''} required /></Field>
			<Field label="Password" for="password"><Input id="password" name="password" type="password" autocomplete="current-password" required /></Field>
			{#if form?.error}<p class="text-danger" role="alert">{form.error}</p>{/if}
			<Button type="submit" class="w-full" loading={busy}>Masuk</Button>
		</form>
	</div>
</div>
