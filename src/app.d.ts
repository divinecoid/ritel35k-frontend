declare global {
	namespace App {
		interface Locals {
			/** Authenticated fetch against the Go API (path relative to /api/v1). */
			api: (path: string, init?: RequestInit) => Promise<Response>;
		}
	}
}

export {};
