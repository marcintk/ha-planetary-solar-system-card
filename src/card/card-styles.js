export const CARD_STYLES = `
  :host {
    display: block;
  }
  .card {
    background: transparent;
    border-radius: 0px;
    padding: 0px;
    color: #ffffff;
    font-family: sans-serif;
  }
  .date {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    margin: 2px 2px;
  }
  .solar-view-wrapper {
    overflow: hidden;
    position: relative;
  }
  .status-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(42, 42, 42, 0.3);
    font-size: 9px;
    color: rgba(255, 255, 255, 0.85);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 8px;
    pointer-events: none;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
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
  #solar-view svg {
    cursor: grab;
    user-select: none;
    touch-action: none;
  }
  .nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }
  .nav button {
    background: rgba(42, 42, 42, 0.3);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
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
    background: #3a3a3a;
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
    background: #2a2a2a;
    color: rgba(255, 255, 255, 0.8);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    height: 18px;
    line-height: 18px;
    padding: 0 4px;
    font-size: 9px;
    font-family: sans-serif;
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }
`;
