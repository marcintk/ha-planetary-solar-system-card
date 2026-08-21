const REPLAY_STEPS = 36;
const DAY_MS = 86400000;

type NavUnit = "hour" | "day" | "month";

/**
 * How far one replay frame advances, per navigation unit. Every mode gets REPLAY_STEPS
 * frames, so the span is simply 36 × the step: 12h, 36 days, 180 days (~6 months).
 *
 * The day and month steps are whole days on purpose. calculateObserverAngle (observer.ts)
 * adds Earth's daily spin — a full turn per 24h — on top of the orbital angle, so a step
 * that is not a whole number of days lands each frame at a different time of day and swings
 * the visibility cone and needle wildly. Whole days hold that term constant, leaving only
 * orbital motion on screen. That is also why the month step is 5 days rather than a calendar
 * month: whole *days* are the real constraint, and 36 × 5 lands close enough to six months
 * while keeping the frame count uniform (#128).
 */
const REPLAY_STEP_MS: Record<NavUnit, number> = {
  hour: (12 * 60 * 60 * 1000) / REPLAY_STEPS, // 20 minutes
  day: DAY_MS,
  month: 5 * DAY_MS,
};
const REPLAY_LABEL: Record<NavUnit, string> = { hour: "12h", day: "36d", month: "6mo" };
const REPLAY_MAX_DURATION_MS = 5000;
const REPLAY_INTERVAL_MS = Math.floor(REPLAY_MAX_DURATION_MS / REPLAY_STEPS);

function addMonths(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

/**
 * Owns the displayed date and its live/paused/replaying transitions. Every mutator is one
 * legal transition; call sites never touch _isLiveMode/_isReplaying/_replayTimer directly,
 * so combinations that used to be hand-reconciled across five card.ts methods (#101 review)
 * are no longer representable. onChange fires after every mutation the caller needs to
 * react to (same callback pattern as ZoomAnimator's onFrame).
 */
export class DateNavigation {
  private _currentDate: Date;
  private _isLiveMode: boolean;
  private _isReplaying: boolean;
  private _replayTimer: number | null;
  private _navUnit: NavUnit;
  private _onChange: () => void;

  constructor(onChange: () => void, initialDate: Date = new Date()) {
    this._currentDate = initialDate;
    this._isLiveMode = true;
    this._isReplaying = false;
    this._replayTimer = null;
    this._navUnit = "hour";
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

  /** Human-readable span of the next replay: "12h" / "36d" / "6mo". */
  get replayLabel(): string {
    return REPLAY_LABEL[this._navUnit];
  }

  /** Auto-update tick: advances to now only while live, no-op otherwise (includes replay). */
  tick(): void {
    if (!this._isLiveMode) return;
    this._currentDate = new Date();
    this._onChange();
  }

  goLive(): void {
    this._navUnit = "hour";
    this._isLiveMode = true;
    this._currentDate = new Date();
    this._onChange();
  }

  /**
   * `unit` is not decoration: it sets the replay span and its button label as well as
   * moving the date, so it is mandatory rather than defaulted. A caller that omitted it
   * would silently register an hour-scale replay for a day-scale jump (#128).
   */
  navigate(deltaMs: number, unit: "hour" | "day"): void {
    this._navUnit = unit;
    this._isLiveMode = false;
    this._currentDate = new Date(this._currentDate.getTime() + deltaMs);
    this._onChange();
  }

  navigateMonths(delta: number): void {
    this._navUnit = "month";
    this._isLiveMode = false;
    this._currentDate = addMonths(this._currentDate, delta);
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
    const end = this._currentDate;
    this._isLiveMode = false;
    this._isReplaying = true;
    let step = 0;
    this._currentDate = this._replayFrame(end, 0);
    this._onChange();

    this._replayTimer = setInterval(() => {
      step++;
      if (step >= REPLAY_STEPS) {
        this._finishReplay(end.getTime(), wasLiveMode);
        return;
      }
      this._currentDate = this._replayFrame(end, step);
      this._onChange();
    }, REPLAY_INTERVAL_MS) as unknown as number;
  }

  /**
   * Date shown at frame `step`, counted forward from the start of the span (step 0) to the
   * pre-replay date (step REPLAY_STEPS). Derived from `end` rather than accumulated, so
   * rounding cannot drift over the run — and pure millisecond arithmetic, which is what
   * keeps the UTC time of day (and so the observer cone) fixed for whole-day steps.
   */
  private _replayFrame(end: Date, step: number): Date {
    const back = REPLAY_STEPS - step;
    return new Date(end.getTime() - back * REPLAY_STEP_MS[this._navUnit]);
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
