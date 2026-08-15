import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
    color-scheme: light dark;
    background: var(--ha-card-background, var(--card-background-color, var(--primary-background-color, Canvas)));
    color: var(--primary-text-color, CanvasText);
  }
  .card {
    border-radius: 0px;
    padding: 0px;
    color: inherit;
    font-family: sans-serif;
  }
  .date {
    font-size: 11px;
    color: var(--secondary-text-color, color-mix(in srgb, currentColor 60%, transparent));
    margin: 2px 2px;
  }
  .solar-view-wrapper {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .status-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.55);
    font-size: 10px;
    color: #fff;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 8px;
    pointer-events: none;
    font-family: sans-serif;
    z-index: 1;
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
    width: 100%;
    aspect-ratio: 1;
  }
  #solar-view.hidden {
    display: none;
  }
  #solar-view svg {
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
    background: #000;
    overflow: hidden;
    cursor: pointer;
  }
  .gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .gallery-label {
    position: absolute;
    bottom: 1px;
    right: 2px;
    font-size: 8px;
    color: #fff;
    text-shadow: 0 0 2px #000;
    font-family: sans-serif;
    pointer-events: none;
  }
  .gallery-age {
    position: absolute;
    top: 1px;
    left: 2px;
    font-size: 8px;
    color: #fff;
    text-shadow: 0 0 2px #000;
    font-family: sans-serif;
    pointer-events: none;
  }
  .nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    position: relative;
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
    background: var(--secondary-background-color, color-mix(in srgb, currentColor 20%, transparent));
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
    color: var(--secondary-text-color, color-mix(in srgb, currentColor 30%, transparent));
    user-select: none;
    font-family: sans-serif;
    position: absolute;
    right: 6px;
    bottom: 4px;
  }
`;
