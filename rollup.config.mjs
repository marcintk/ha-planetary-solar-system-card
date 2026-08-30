import { cardBundle } from "ha-card-shared/rollup.base.mjs";

// Pin the bundle name to card.js. v2's cardBundle() defaults to the package name
// (ha-planetary-solar-system-card.js); keeping card.js avoids a HACS resource-URL
// break for existing installs. hacs.json "filename" points HACS at this exact file.
export default cardBundle({ name: "card" });
