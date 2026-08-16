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
  .status-bar {
    position: relative;
    flex: 0 0 auto;
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
  .image-view {
    display: none;
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    background: #000;
    cursor: pointer;
  }
  .image-view.visible {
    display: block;
  }
  .gallery {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 2px;
    padding: 2px;
    box-sizing: border-box;
  }
  .gallery-thumb {
    flex: 0 0 20%;
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid var(--divider-color, color-mix(in srgb, currentColor 15%, transparent));
    border-radius: 4px;
    background: transparent;
    overflow: hidden;
    cursor: pointer;
  }
  .gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .gallery-info {
    position: absolute;
    bottom: 1px;
    left: 2px;
    right: 2px;
    display: flex;
    justify-content: space-between;
    pointer-events: none;
  }
  .gallery-label,
  .gallery-age {
    font-size: 8px;
    color: #fff;
    text-shadow: 0 0 2px #000;
    font-family: sans-serif;
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
  button[data-action="show-earth"].active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }
  button[data-action="show-sun"].active {
    background: #f97316;
    border-color: #f97316;
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
