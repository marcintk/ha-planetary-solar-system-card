import {
  computeNextTransitionTime,
  computeSolarElevationDeg,
  getSkyMode,
} from "../astronomy/solar-position.js";
import { CARD_STYLES } from "./card-styles.js";

/**
 * Build the status bar HTML fragment.
 *
 * @param {{ lat: number, lon: number, timezone: string } | null} locationData
 * @param {string | null} locationName
 * @param {Date} currentDate
 * @returns {string} HTML fragment, or empty string when locationData is null
 */
export function buildStatusBarHtml(locationData, locationName, currentDate) {
  if (!locationData) return "";

  const elevDeg = computeSolarElevationDeg(locationData.lat, locationData.lon, currentDate);
  const mode = getSkyMode(elevDeg);
  const elevRounded = Math.round(elevDeg);
  const next = computeNextTransitionTime(locationData.lat, locationData.lon, currentDate);
  let rightSpan = "";
  if (next) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: locationData.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    rightSpan = `<span>Next: ${next.toMode} (${formatter.format(next.time)})</span>`;
  }
  const name = locationName || "";
  return `<div class="status-bar"><span>${name} | ${mode} (${elevRounded}°)</span>${rightSpan}</div>`;
}

/**
 * Build the complete shadowRoot.innerHTML string.
 *
 * @param {string} statusBarHtml - result of buildStatusBarHtml()
 * @param {string} formattedDate - pre-formatted date string
 * @param {number} zoomLevel - current zoom level integer
 * @returns {string} complete innerHTML including <style> and card HTML
 */
export function buildCardHtml(statusBarHtml, formattedDate, zoomLevel) {
  return `
    <style>${CARD_STYLES}</style>
    <div class="card">
      <div class="solar-view-wrapper">
        ${statusBarHtml}
        <div id="solar-view"></div>
      </div>
      <div class="nav">
        <span class="btn-group">
          <button data-action="month-back">\u22D8</button>
          <button data-action="day-back">\u00AB</button>
          <button data-action="hour-back">\u2039</button>
          <button data-action="today">Now</button>
          <button data-action="hour-forward">\u203A</button>
          <button data-action="day-forward">\u00BB</button>
          <button data-action="month-forward">\u22D9</button>
        </span>
        <span class="nav-spacer"></span>
        <span class="date">${formattedDate}</span>
        <span class="nav-spacer"></span>
        <span class="btn-group">
          <button data-action="zoom-out">&minus;</button>
          <span class="zoom-level">${zoomLevel}</span>
          <button data-action="zoom-in">+</button>
        </span>
      </div>
    </div>
  `;
}
