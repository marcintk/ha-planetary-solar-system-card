/// <reference path="../node_modules/ha-card-shared/globals.d.ts" />
import { SolarViewCard } from "./card/card.js";

customElements.define("ha-planetary-solar-system-card", SolarViewCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-planetary-solar-system-card",
  name: "Solar View Card",
  description: "Planetary solar system visualization card",
  preview: false,
});
