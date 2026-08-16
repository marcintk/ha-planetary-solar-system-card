const REPLAY_WINDOW_MS = 6 * 60 * 60 * 1000;
const REPLAY_STEPS = 36;
const REPLAY_STEP_MS = REPLAY_WINDOW_MS / REPLAY_STEPS;
const REPLAY_MAX_DURATION_MS = 5000;
const REPLAY_INTERVAL_MS = Math.floor(REPLAY_MAX_DURATION_MS / REPLAY_STEPS);

/**
 * Owns the displayed date and its live/paused/replaying transitions. Every mutator is one
 * legal transition; call sites never touch _isLiveMode/_isReplaying/_replayTimer directly,
 * so combinations that used to be hand-reconciled across five card.ts methods (#101 review)
 * are no longer representable. onChange fires after every mutation the caller needs to
 * react to (same callback pattern as ZoomAnimator's onFrame).
 */
export class DateNav {
  private _currentDate: Date;
  private _isLiveMode: boolean;
  private _isReplaying: boolean;
  private _replayTimer: number | null;
  private _onChange: () => void;

  constructor(onChange: () => void, initialDate: Date = new Date()) {
    this._currentDate = initialDate;
    this._isLiveMode = true;
    this._isReplaying = false;
    this._replayTimer = null;
    this._onChange = onChange;
  }

  get currentDate(): Date {
    return this._currentDate;
  }
  // ponytail: test-seeding setters only, mirrors the direct-field-poke pattern used
  // throughout this codebase's tests (no production call site needs to set these).
  set currentDate(date: Date) {
    this._currentDate = date;
  }
  get isLiveMode(): boolean {
    return this._isLiveMode;
  }
  set isLiveMode(value: boolean) {
    this._isLiveMode = value;
  }
  get isReplaying(): boolean {
    return this._isReplaying;
  }

  /** Auto-update tick: advances to now only while live, no-op otherwise (includes replay). */
  tick(): void {
    if (!this._isLiveMode) return;
    this._currentDate = new Date();
    this._onChange();
  }

  goLive(): void {
    this._isLiveMode = true;
    this._currentDate = new Date();
    this._onChange();
  }

  navigate(deltaMs: number): void {
    this._isLiveMode = false;
    this._currentDate = new Date(this._currentDate.getTime() + deltaMs);
    this._onChange();
  }

  navigateMonths(delta: number): void {
    this._isLiveMode = false;
    const d = new Date(this._currentDate);
    d.setMonth(d.getMonth() + delta);
    this._currentDate = d;
    this._onChange();
  }

  toggleReplay(): void {
    if (this._replayTimer !== null) {
      this._cancelReplay();
    } else {
      this._startReplay();
    }
  }

  /** Clears any running replay interval without restoring the pre-replay date (disconnect path). */
  stop(): void {
    /* v8 ignore next */
    clearInterval(this._replayTimer ?? undefined);
    this._replayTimer = null;
  }

  private _startReplay(): void {
    const wasLiveMode = this._isLiveMode;
    const endTime = this._currentDate.getTime();
    const startTime = endTime - REPLAY_WINDOW_MS;
    this._isLiveMode = false;
    this._isReplaying = true;
    let step = 0;
    this._currentDate = new Date(startTime);
    this._onChange();

    this._replayTimer = setInterval(() => {
      step++;
      if (step >= REPLAY_STEPS) {
        this._finishReplay(endTime, wasLiveMode);
        return;
      }
      this._currentDate = new Date(startTime + step * REPLAY_STEP_MS);
      this._onChange();
    }, REPLAY_INTERVAL_MS) as unknown as number;
  }

  private _finishReplay(endTime: number, resumeLiveMode: boolean): void {
    /* v8 ignore next */
    clearInterval(this._replayTimer ?? undefined);
    this._replayTimer = null;
    this._isReplaying = false;
    this._isLiveMode = resumeLiveMode;
    // Always return to the date the user was viewing before replay started,
    // regardless of live mode — replay should not jump the view forward.
    this._currentDate = new Date(endTime);
    this._onChange();
  }

  private _cancelReplay(): void {
    /* v8 ignore next */
    clearInterval(this._replayTimer ?? undefined);
    this._replayTimer = null;
    this._isReplaying = false;
    this._onChange();
  }
}
