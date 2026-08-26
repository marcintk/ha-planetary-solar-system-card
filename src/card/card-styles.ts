import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
    /* HA's grid-based views (sections/masonry) stretch grid items to fill their row by
       default. Without this, the host box grows past the card's own content height,
       leaving blank host background below the nav bar. */
    align-self: start;
    color-scheme: light dark;
    background: var(--ha-card-background, var(--card-background-color, var(--primary-background-color, Canvas)));
    color: var(--primary-text-color, CanvasText);
    /* :host is the same size as .card (see align-self above) and paints its own
       background — without matching its radius+clip, that square background pokes out
       past .card's rounded corners. */
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: hidden;
  }
  .card {
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: hidden;
    padding: 0px;
    color: inherit;
    font-family: sans-serif;
  }
  .date {
    font-size: 11px;
    color: inherit;
    margin: 2px 2px;
  }
  .solar-view-wrapper {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .status-bar-row {
    position: relative;
    flex: 0 0 auto;
  }
  .status-bar {
    position: relative;
    background: var(--secondary-background-color, color-mix(in srgb, currentColor 10%, transparent));
    font-size: 10px;
    color: inherit;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 8px;
    pointer-events: none;
    font-family: sans-serif;
    box-sizing: border-box;
  }
  .status-bar span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status-bar span:first-child {
    min-width: 0;
  }
  #solar-view {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
  }
  #solar-view.hidden {
    display: none;
  }
  /* Absolutely positioned so the SVG's own width/height="100%" can't feed back into
     #solar-view's own size — a percentage-height replaced child inside an aspect-ratio box
     is a circular dependency that makes browsers ignore the aspect-ratio override entirely. */
  #solar-view svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: grab;
    user-select: none;
    touch-action: none;
  }
  /* The clipping box: fixed square, sized/height-capped the way .image-view itself used to be.
     The sky tile's image rotates inside it (see .image-view below); overflow: hidden crops
     whatever the rotated square swings past this frame's own edge, so the panel stays a square
     like every other source's — the rotated image can't ride up over the status bar above it,
     because it never paints outside this frame's own box in the first place. */
  .image-view-frame {
    display: none;
    /* Static by default, which would let .no-sky's inset escape to the card. */
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    /* The sky tile is the only image ever rotated here, and the corners a rotated square
       swings away from show this, not the image's own background — plain black, always,
       same as every other panel. */
    background: #000;
  }
  .image-view-frame.visible {
    display: block;
  }
  .image-view {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
    cursor: pointer;
    display: block;
  }
  /* The sky-elevation wash and #178's Moon altitude-extinction tint, same mix-blend-mode: color
     trick as .gallery-thumb-tint but sized to the whole square frame rather than clipped to a
     disc — the panel image has no circle crop to match (see discStyle()). Two stacked layers,
     same order as the thumbnail: wash always on, extinction on top of it when
     gallery.mymoon_tint is enabled (see card.ts). */
  .image-view-tint {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    mix-blend-mode: color;
    pointer-events: none;
  }
  /* Stands in for the image, in the tile and in the full-screen panel alike: fills whichever
     box it lands in and centres on both axes, so one rule serves a 104px thumbnail and a
     full-width panel without either needing to know about the other. */
  .no-sky {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4px;
    box-sizing: border-box;
    background: #000;
    /* Fixed white, not currentColor: the tile and the panel frame are #000 in every theme
       (see .gallery-thumb / .image-view-frame), so a theme-following colour would resolve to
       dark ink on black the moment the card is on a light theme. Same reasoning as
       .gallery-label/.gallery-age below, just dimmer — this reads as an absence, not a label. */
    color: rgba(255, 255, 255, 0.65);
    line-height: 1.2;
    cursor: pointer;
    font-size: 1rem;
  }
  /* Only the tile scales with its own width, against the container query .gallery-thumb
     already declares — floored in px so it stays legible on a narrow card. Deliberately not
     on the shared rule above: .image-view-frame is not a query container, so cqw there would
     resolve against the viewport and render the panel's copy many times too large. */
  .gallery-thumb .no-sky {
    font-size: max(9px, 13cqw);
  }
  .gallery {
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 2px;
    padding: 2px;
    box-sizing: border-box;
  }
  /* Floats over the bottom of the solar view: costs no card height, covers the outer orbits. */
  .gallery-overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }
  /* A plain flex item of .solar-view-wrapper instead, so the card grows by the strip's own
     height and nothing is hidden behind it. Only flex-shrink needs stating — everything else
     is already the default now that .gallery itself no longer positions. */
  .gallery-below {
    flex-shrink: 0;
  }
  .gallery-thumb {
    /* Shares the row rather than claiming a fixed 20%: four tiles ship, and debug:true adds a
       fifth, which at a fixed basis overflows once gaps and padding are counted. */
    flex: 1 1 0;
    max-width: 20%;
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    /* Buttons get border-box from the UA stylesheet, a plain <div> does not — without this
       the moon tile's 1px border falls outside its 20% flex-basis and it renders 2px larger
       than the Earth/Sun tiles beside it. */
    box-sizing: border-box;
    /* Explicit, not omitted: .gallery-thumb is a <button> on the fetched tiles, and dropping
       the rule entirely hands it back the UA stylesheet's 2px outset ButtonBorder. */
    border: 0;
    /* Every source is cropped to its body and rescaled to a shared target size (see
       discStyle()), so a margin of tile the disc doesn't reach is now the normal case, not
       just the rotating sky tile's — the backdrop belongs here for all of them. */
    background: #000;
    overflow: hidden;
    cursor: pointer;
    /* Makes the tile itself the query container, so the caption below can size against the
       tile's real width rather than a fixed px guess that only fits on a wide card. */
    container-type: inline-size;
  }
  .gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  /* The sky tile's day/twilight/night color, washed over the photo itself rather than filling
     the tile behind it — a flat colored square reads oddly once the Moon disc is gone (below
     horizon, nothing to wash), so the color only ever shows up attached to the Moon that's
     wearing it. mix-blend-mode: color keeps the photo's own luminance (the phase's lit/dark
     shape stays legible) while replacing its hue/saturation with the overlay's — the same
     shape and clip-path/transform as the image underneath it, so the tint never spills past
     the disc's own edge. Pointer-events: none so it doesn't steal the tile's click. */
  .gallery-thumb-tint {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    mix-blend-mode: color;
    pointer-events: none;
  }
  /* discStyle() clip-paths the <img> alone, and the disc's own corners are already black —
     the same color as .gallery-thumb's backdrop — so a circle-clipped photo on a square black
     tile is pixel-identical to a square-clipped one. The tile itself has to round too for
     gallery.shape: circle to read as anything. */
  /* .gallery-thumb's black background stays doing double duty: the loading filler before the
     <img> has a decoded frame, and — once loaded — the thin ring TARGET_FRACTION deliberately
     leaves outside the disc (see discStyle()) rather than scaling all the way to the tile's
     own edge. */
  .gallery-thumb-circle {
    border-radius: 50%;
  }
  .gallery-info {
    position: absolute;
    /* Spans the whole tile so the two lines can take its top and bottom edges. Stacked and
       centred rather than a single row split left/right: once the thumbnails are clipped to
       the body, a full-width row runs off the disc at both ends, and centring on the tile
       centres on the body too — the sources all sit their subject dead centre in frame. */
    inset: 1px 2px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    /* font-size and line-height are pinned on the container, not just the spans, because
       the tiles are built from different elements — a <div> for the moon, a <button> for the
       fetched sources — and a <button> takes its font from the UA stylesheet (13.333px)
       while the <div> inherits the card's (16px). Left to inherit, the caption's height is
       decided by the element type and the engine's default line-height, which is how the
       moon's caption ended up sitting higher than its neighbours'.
       Scales with the tile (see container-type above) instead of a fixed 8px, so the longest
       phase name still fits on a narrow card and stays legible on a wide one — same idea as
       the SVG body labels, which scale with the card because the whole SVG does. The old 9px
       ceiling stopped the caption growing past a small card's size while the planet labels
       beside it kept scaling; 40px is a backstop against a pathological giant tile, not a
       real-world limit — a tile would need to be ~440px wide before 9cqw even reaches it. */
    font-size: clamp(6px, 9cqw, 40px);
    line-height: 1;
    font-family: sans-serif;
    pointer-events: none;
  }
  /* A circular tile's own curve pulls away from its corners fastest right where the top and
     bottom text sits — the same 1px inset a square tile's flat edge takes reads as cramped
     against that curve. 2px more top and bottom (not the sides, where the curve is nearly flat
     at mid-height) gives the text the same visual clearance the square tile already has. */
  .gallery-thumb-circle .gallery-info {
    inset: 4px 2px;
  }
  .gallery-label,
  .gallery-age {
    font: inherit;
    color: #fff;
    /* Three stacked shadows, not one. The caption used to sit entirely on the image's black
       margin; now the thumbnails are clipped to the body itself, so its ends overhang the
       card — white on a light theme's white. A single 2px glow was not enough contrast to
       survive that, and the caption also has to stay readable where it crosses a sunlit limb,
       so a solid backdrop is out: it would put a dark bar under a floating disc. */
    text-shadow:
      0 0 2px #000,
      0 0 3px #000,
      0 1px 2px #000;
    white-space: nowrap;
  }
  .nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    position: relative;
    background: var(--secondary-background-color, color-mix(in srgb, currentColor 10%, transparent));
  }
  .nav button {
    background: color-mix(in srgb, currentColor 15%, transparent);
    color: inherit;
    border: 1px solid var(--divider-color, color-mix(in srgb, currentColor 15%, transparent));
    border-radius: 6px;
    height: 18px;
    line-height: 18px;
    padding: 0 5px;
    min-width: 20px;
    font-size: 10px;
    cursor: pointer;
    font-family: sans-serif;
    box-sizing: border-box;
  }
  .nav button:hover {
    background: color-mix(in srgb, currentColor 25%, transparent);
  }
  .nav button .icon {
    filter: grayscale(1);
    display: inline-block;
  }
  /* "Now" lights up while the view sits off-default, so there's a visible way back. */
  button[data-action="today"].active {
    background: var(--accent-color, #f59e0b);
    border-color: var(--accent-color, #f59e0b);
    color: #fff;
  }
  .btn-group {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0;
  }
  .btn-group button {
    border-radius: 0;
  }
  .btn-group button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .btn-group button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .btn-group button:only-child {
    border-radius: 6px;
  }
  .nav-spacer {
    width: 8px;
  }
  .zoom-level {
    background: color-mix(in srgb, currentColor 15%, transparent);
    color: inherit;
    border-top: 1px solid var(--divider-color, color-mix(in srgb, currentColor 15%, transparent));
    border-bottom: 1px solid var(--divider-color, color-mix(in srgb, currentColor 15%, transparent));
    height: 18px;
    line-height: 18px;
    padding: 0 4px;
    font-size: 9px;
    font-family: sans-serif;
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }
  .debug-overlay {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    z-index: 1;
    box-sizing: border-box;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.55);
    color: #00e676;
    font-family: monospace;
    font-size: 10px;
    line-height: 1.3;
    padding: 3px 6px;
  }
  .debug-caption {
    color: #66bb9a;
    margin-top: 2px;
  }
  .debug-overlay table {
    width: 100%;
    border-collapse: collapse;
  }
  .debug-overlay th,
  .debug-overlay td {
    padding: 0 6px 0 0;
    text-align: right;
    white-space: nowrap;
  }
  .debug-overlay th:first-child,
  .debug-overlay td:first-child {
    text-align: left;
  }
  .debug-overlay th {
    color: #66bb9a;
    font-weight: normal;
  }
  .debug-total td {
    border-top: 1px solid rgba(0, 230, 118, 0.3);
    color: #66bb9a;
  }
  .card-version {
    font-size: 9px;
    color: #9e9e9e;
    user-select: none;
    font-family: sans-serif;
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
  }
`;
