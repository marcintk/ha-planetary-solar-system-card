import { renderSolarSystem } from "./renderer.js";

const ZOOM_IN_FACTOR = 0.8;
const ZOOM_OUT_FACTOR = 1.25;
const MIN_VIEW_SIZE = 100;
const FULL_SYSTEM_SIZE = 800;

export class SolarViewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._currentDate = new Date();
    // View state (initialized on first render)
    this._viewCenterX = null;
    this._viewCenterY = null;
    this._viewWidth = null;
    this._viewHeight = null;
    // Hemisphere for season labels (default: north)
    this._hemisphere = "north";
    // Auto-update timer
    this._autoUpdateTimer = null;
    // Drag state
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartCenterX = 0;
    this._dragStartCenterY = 0;
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = config;
  }

  connectedCallback() {
    this._detectHemisphere();
    this._render();
    clearInterval(this._autoUpdateTimer);
    this._autoUpdateTimer = setInterval(() => {
      if (this._formatDate(this._currentDate).slice(0, 10) === this._formatDate(new Date()).slice(0, 10)) {
        this._currentDate = new Date();
        this._render();
      }
    }, 60000);
  }

  disconnectedCallback() {
    clearInterval(this._autoUpdateTimer);
    this._autoUpdateTimer = null;
  }

  _formatDate(date) {
    const y = String(date.getFullYear()).slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  _navigate(deltaDays) {
    this._currentDate = new Date(
      this._currentDate.getTime() + deltaDays * 86400000
    );
    this._render();
  }

  _goToday() {
    this._currentDate = new Date();
    // Reset view to fixed full-system extent
    this._viewCenterX = FULL_SYSTEM_SIZE / 2;
    this._viewCenterY = FULL_SYSTEM_SIZE / 2;
    this._viewWidth = FULL_SYSTEM_SIZE;
    this._viewHeight = FULL_SYSTEM_SIZE;
    this._render();
  }

  _detectHemisphere() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newHemisphere = pos.coords.latitude < 0 ? "south" : "north";
          if (newHemisphere !== this._hemisphere) {
            this._hemisphere = newHemisphere;
            this._render();
          }
        },
        () => {} // Geolocation denied or unavailable — keep default
      );
    }
  }

  _zoomIn() {
    const newWidth = this._viewWidth * ZOOM_IN_FACTOR;
    const newHeight = this._viewHeight * ZOOM_IN_FACTOR;
    this._viewWidth = Math.max(newWidth, MIN_VIEW_SIZE);
    this._viewHeight = Math.max(newHeight, MIN_VIEW_SIZE);
    this._updateViewBox();
  }

  _zoomOut() {
    const newWidth = this._viewWidth * ZOOM_OUT_FACTOR;
    const newHeight = this._viewHeight * ZOOM_OUT_FACTOR;
    this._viewWidth = Math.min(newWidth, FULL_SYSTEM_SIZE);
    this._viewHeight = Math.min(newHeight, FULL_SYSTEM_SIZE);
    this._updateViewBox();
  }

  _updateViewBox() {
    const svg = this.shadowRoot.querySelector("#solar-view svg");
    if (svg) {
      const minX = this._viewCenterX - this._viewWidth / 2;
      const minY = this._viewCenterY - this._viewHeight / 2;
      svg.setAttribute(
        "viewBox",
        `${minX} ${minY} ${this._viewWidth} ${this._viewHeight}`
      );
    }
  }

  _onPointerDown(e) {
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);
    this._isDragging = true;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._dragStartCenterX = this._viewCenterX;
    this._dragStartCenterY = this._viewCenterY;
    svg.style.cursor = "grabbing";
  }

  _onPointerMove(e) {
    if (!this._isDragging) return;
    const svg = e.currentTarget;
    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    // Convert screen pixels to SVG coordinates
    const rect = svg.getBoundingClientRect();
    const scaleX = this._viewWidth / rect.width;
    const scaleY = this._viewHeight / rect.height;
    this._viewCenterX = this._dragStartCenterX - dx * scaleX;
    this._viewCenterY = this._dragStartCenterY - dy * scaleY;
    this._updateViewBox();
  }

  _onPointerUp(e) {
    if (!this._isDragging) return;
    this._isDragging = false;
    const svg = e.currentTarget;
    svg.releasePointerCapture(e.pointerId);
    svg.style.cursor = "grab";
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card {
          background: #1e1e1e;
          border-radius: 12px;
          padding: 2px;
          color: #ffffff;
          font-family: sans-serif;
        }
        .date {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 8px;
        }
        .solar-view-wrapper {
          overflow: hidden;
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
          margin-top: 12px;
        }
        .nav button {
          background: #2a2a2a;
          color: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 2px 5px;
          font-size: 10px;
          cursor: pointer;
          font-family: sans-serif;
        }
        .nav button:hover {
          background: #3a3a3a;
        }
        .nav button.today {
          background: #2a2a2a;
        }
        .nav button.today:hover {
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
      </style>
      <div class="card">
        <div class="solar-view-wrapper">
          <div id="solar-view"></div>
        </div>
        <div class="nav">
          <button data-action="month-back">&lt;&lt;</button>
          <button data-action="day-back">&lt;</button>
          <button data-action="today" class="today">Today</button>
          <span class="date">${this._formatDate(this._currentDate)}</span>
          <button data-action="day-forward">&gt;</button>
          <button data-action="month-forward">&gt;&gt;</button>
          <span class="btn-group">
            <button data-action="zoom-out">&minus;</button>
            <button data-action="zoom-in">+</button>
          </span>
        </div>
      </div>
    `;

    const container = this.shadowRoot.getElementById("solar-view");
    const { svg } = renderSolarSystem(this._currentDate, this._hemisphere);
    container.appendChild(svg);

    // Initialize view state to fixed full-system extent
    if (this._viewCenterX === null) {
      this._viewCenterX = FULL_SYSTEM_SIZE / 2;
      this._viewCenterY = FULL_SYSTEM_SIZE / 2;
      this._viewWidth = FULL_SYSTEM_SIZE;
      this._viewHeight = FULL_SYSTEM_SIZE;
    }

    this._updateViewBox();

    // Wire up pointer events for drag-to-pan
    svg.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    svg.addEventListener("pointermove", (e) => this._onPointerMove(e));
    svg.addEventListener("pointerup", (e) => this._onPointerUp(e));

    // Wire up navigation buttons
    this.shadowRoot.querySelectorAll(".nav button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = e.currentTarget.dataset.action;
        switch (action) {
          case "zoom-out":
            this._zoomOut();
            break;
          case "month-back": {
            const d = new Date(this._currentDate);
            d.setMonth(d.getMonth() - 1);
            this._currentDate = d;
            this._render();
            break;
          }
          case "day-back":
            this._navigate(-1);
            break;
          case "today":
            this._goToday();
            break;
          case "day-forward":
            this._navigate(1);
            break;
          case "month-forward": {
            const d = new Date(this._currentDate);
            d.setMonth(d.getMonth() + 1);
            this._currentDate = d;
            this._render();
            break;
          }
          case "zoom-in":
            this._zoomIn();
            break;
        }
      });
    });
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return {};
  }
}
