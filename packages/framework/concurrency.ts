/**
 * A simple async semaphore for capping concurrent tool executions.
 *
 * Usage:
 * ```ts
 * const sem = new Semaphore(3);
 * const result = await sem.run(() => someAsyncWork());
 * ```
 */
export class Semaphore {
	private _permits: number;
	private _queue: Array<() => void> = [];

	constructor(maxConcurrency: number) {
		if (maxConcurrency < 1) {
			throw new RangeError(
				`Semaphore maxConcurrency must be >= 1, got ${maxConcurrency}`,
			);
		}
		this._permits = maxConcurrency;
	}

	/** Acquire a permit, waiting if none are available. */
	private acquire(): Promise<void> {
		if (this._permits > 0) {
			this._permits--;
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => {
			this._queue.push(resolve);
		});
	}

	/** Release a permit, waking the next waiter if any. */
	private release(): void {
		const next = this._queue.shift();
		if (next !== undefined) {
			next();
		} else {
			this._permits++;
		}
	}

	/**
	 * Run `fn` under the semaphore — waits for a permit, executes `fn`,
	 * then releases the permit whether `fn` resolves or rejects.
	 */
	async run<T>(fn: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await fn();
		} finally {
			this.release();
		}
	}
}
