/**
 * Request pacer: at most `rps` requests per second, evenly spaced.
 *
 * Section 10.4 asks for a token bucket of 4 per second. This is the strict
 * form of it (bucket capacity 1, no bursts): bursts are what push a client
 * over a per-second limit at window boundaries, and Qloo's limit is 5/s.
 *
 * Slots are reserved synchronously, so concurrent callers queue in order.
 */
export class Pacer {
   private nextSlot = 0;
   private readonly intervalMs: number;
   private readonly now: () => number;
   private readonly sleep: (ms: number) => Promise<void>;

   constructor(rps: number, now: () => number, sleep: (ms: number) => Promise<void>) {
      this.intervalMs = 1000 / rps;
      this.now = now;
      this.sleep = sleep;
   }

   /** Resolves true once it is this caller's turn; false if the wait would exceed maxWaitMs. */
   async acquire(maxWaitMs: number): Promise<boolean> {
      const t = this.now();
      const slot = Math.max(t, this.nextSlot);
      const wait = slot - t;
      if (wait > maxWaitMs) return false;
      this.nextSlot = slot + this.intervalMs;
      if (wait > 0) await this.sleep(wait);
      return true;
   }
}
