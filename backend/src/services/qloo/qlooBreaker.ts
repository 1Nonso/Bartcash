/**
 * Circuit breaker (Section 10.4): five failures within 60 s open the circuit
 * for 120 s. Then exactly one call is let through; success closes the
 * circuit, failure re-opens it. State is per process.
 */
export interface BreakerOptions {
   threshold?: number;
   windowMs?: number;
   openMs?: number;
}

export class CircuitBreaker {
   private failures: number[] = [];
   private state: 'closed' | 'open' | 'half_open' = 'closed';
   private openUntil = 0;
   private probing = false;
   private readonly threshold: number;
   private readonly windowMs: number;
   private readonly openMs: number;

   constructor(opts: BreakerOptions = {}) {
      this.threshold = opts.threshold ?? 5;
      this.windowMs = opts.windowMs ?? 60_000;
      this.openMs = opts.openMs ?? 120_000;
   }

   /** Non-consuming: would a call be refused right now? */
   wouldRefuse(now: number): boolean {
      if (this.state === 'closed') return false;
      if (this.state === 'open' && now < this.openUntil) return true;
      return this.probing; // a probe is already in flight
   }

   /** Consuming: true if the caller may make the call. Takes the probe slot if half-open. */
   allow(now: number): boolean {
      if (this.state === 'closed') return true;
      if (this.state === 'open') {
         if (now < this.openUntil) return false;
         this.state = 'half_open';
         this.probing = true;
         return true;
      }
      if (this.probing) return false;
      this.probing = true;
      return true;
   }

   /**
    * Qloo answered (a success, or a 4xx that shows it is up). Closes the
    * circuit only if this was the half-open probe; a late result from a call
    * that started before the circuit opened is ignored.
    */
   onSuccess(): void {
      if (this.state === 'half_open') {
         this.state = 'closed';
         this.probing = false;
         this.failures = [];
      }
   }

   onFailure(now: number): void {
      if (this.state === 'half_open') {
         this.open(now);
         return;
      }
      if (this.state === 'open') return; // late result from a call started before opening
      this.failures.push(now);
      this.failures = this.failures.filter((t) => now - t < this.windowMs);
      if (this.failures.length >= this.threshold) this.open(now);
   }

   private open(now: number): void {
      this.state = 'open';
      this.openUntil = now + this.openMs;
      this.probing = false;
      this.failures = [];
   }
}
