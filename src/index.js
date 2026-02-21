import { SolarViewCard } from "./solar-view-card.js";

customElements.define("ha-solar-view-card", SolarViewCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-solar-view-card",
  name: "Solar View Card",
  description: "Planetary solar system visualization card",
});
