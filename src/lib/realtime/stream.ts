/**
 * Server-sent signals ("dashboard" rebuilt, "notification" arrived). Signals carry no data: the page refetches
 * through the normal permission-checked endpoints. EventSource retries by itself after network drops; if the server
 * answers with an error status (e.g. expired session) the browser gives up, so we reopen with a delay.
 */
export function connectStream(onSignal: (kind: 'dashboard' | 'notification') => void): () => void {
	let es: EventSource | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;

	const open = () => {
		es = new EventSource('/api/stream/events');
		es.addEventListener('dashboard', () => onSignal('dashboard'));
		es.addEventListener('notification', () => onSignal('notification'));
		es.onerror = () => {
			if (es?.readyState === EventSource.CLOSED && !stopped) {
				es.close();
				timer = setTimeout(open, 15_000);
			}
		};
	};
	open();
	return () => {
		stopped = true;
		clearTimeout(timer);
		es?.close();
	};
}
