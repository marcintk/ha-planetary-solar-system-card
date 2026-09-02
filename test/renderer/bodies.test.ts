import { describe, expect, it } from "vitest";
import { PLANETS, SUN } from "../../src/astronomy/planet-data.js";
import {
  HALO_VIEW_FRACTION,
  ORBIT_COLOR,
  renderBody,
  renderBodyShadow,
  renderOrbit,
  renderSaturn,
  renderSphereSprite,
  renderSunHalo,
  sunBearing,
} from "../../src/renderer/bodies.js";
import {
  CENTER,
  radiusFromAU,
  SVG_NS,
  terminatorShadowPath,
  VIEW_SIZE,
} from "../../src/renderer/svg-utils.js";

const TERMINATOR_BOW = 0.22;

import type { CometVisualEllipse } from "../../src/types.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

// Circular ellipse (aPx=bPx, no perihelion/aphelion offset) for tests that
// only care about the AU-label/color plumbing, not the ellipse shape.
function circleEllipse(radius: number): CometVisualEllipse {
  return { aPx: radius, bPx: radius, cPx: 0, ePx: 0, rotationDeg: 0 };
}

// Parses transform="matrix(a, b, c, d, e, f)" and reports whether a marker
// point lies on the drawn ellipse (rx=aPx, ry=bPx, local center 0,0).
function markerLiesOnEllipse(
  transform: string,
  ellipse: CometVisualEllipse,
  markerX: number,
  markerY: number
): boolean {
  const [a, b, c, d, e, f] = transform
    .replace(/matrix\(|\)/g, "")
    .split(",")
    .map(Number);
  const det = a * d - b * c;
  // Invert the 2x2 linear part and undo the translation to get back to the
  // ellipse's local (untransformed) coordinates.
  const px = markerX - e;
  const py = markerY - f;
  const localX = (d * px - c * py) / det;
  const localY = (-b * px + a * py) / det;
  const value = (localX / ellipse.aPx) ** 2 + (localY / ellipse.bPx) ** 2;
  return Math.abs(value - 1) < 1e-9;
}

describe("renderOrbit", () => {
  it("appends a dashed ellipse at the given radii", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const orbit = svg.querySelector('ellipse[stroke-dasharray="5, 5"]');
    expect(orbit).not.toBeNull();
    expect(orbit.getAttribute("rx")).toBe("200");
    expect(orbit.getAttribute("ry")).toBe("200");
    expect(orbit.getAttribute("cx")).toBe("0");
    expect(orbit.getAttribute("cy")).toBe("0");
    expect(orbit.getAttribute("fill")).toBe("none");
  });

  it("uses ORBIT_COLOR for the stroke", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const orbit = svg.querySelector('ellipse[stroke-dasharray="5, 5"]');
    expect(orbit.getAttribute("style")).toBe(`stroke: ${ORBIT_COLOR}`);
  });

  it("places a circular ellipse (rotationDeg=0) centered on CENTER via its transform", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const orbit = svg.querySelector('ellipse[stroke-dasharray="5, 5"]');
    expect(orbit.getAttribute("transform")).toBe(`matrix(1, 0, 0, -1, ${CENTER}, ${CENTER})`);
  });

  it.each([-1, 1])(
    "marker positions (from the same polar-focus formula the renderer uses) land exactly on the drawn ellipse, eclipticViewDirection=%i",
    (eclipticViewDirection) => {
      const svg = createSvg();
      const aPx = 220;
      const cPx = 90;
      const bPx = Math.sqrt(aPx * aPx - cPx * cPx);
      const ellipse: CometVisualEllipse = { aPx, bPx, cPx, ePx: cPx / aPx, rotationDeg: 35 };
      renderOrbit(svg, ellipse, eclipticViewDirection);

      const orbit = svg.querySelector('ellipse[stroke-dasharray="5, 5"]');
      const transform = orbit.getAttribute("transform");

      const rotationRad = (ellipse.rotationDeg * Math.PI) / 180;
      for (const trueAnomaly of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const angle = trueAnomaly + rotationRad;
        const r =
          (ellipse.aPx * (1 - ellipse.ePx * ellipse.ePx)) /
          (1 + ellipse.ePx * Math.cos(trueAnomaly));
        const markerX = CENTER + r * Math.cos(angle);
        const markerY = CENTER + eclipticViewDirection * r * Math.sin(angle);
        expect(markerLiesOnEllipse(transform, ellipse, markerX, markerY)).toBe(true);
      }
    }
  );

  it("appends two AU text labels (top and bottom) showing the ring's real distance from the Sun", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const expectedText = `${radiusFromAU(200).toFixed(1)} AU`;
    const labels = Array.from(svg.querySelectorAll("text")).filter(
      (t) => t.textContent === expectedText
    );
    expect(labels.length).toBe(2);
  });

  it("top AU label is above center and bottom label is below center", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const labels = Array.from(svg.querySelectorAll("text[font-size='9']"));
    const ys = labels.map((t) => Number(t.getAttribute("y")));
    expect(ys.some((y) => y < CENTER)).toBe(true);
    expect(ys.some((y) => y > CENTER)).toBe(true);
  });

  it("AU labels are text-anchor: start and offset right of center", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const labels = Array.from(svg.querySelectorAll("text[font-size='9']"));
    for (const label of labels) {
      expect(label.getAttribute("text-anchor")).toBe("start");
      expect(Number(label.getAttribute("x"))).toBeGreaterThanOrEqual(CENTER);
    }
  });

  it("formats the AU label to one decimal place", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(100), -1);

    const expectedText = `${radiusFromAU(100).toFixed(1)} AU`;
    const texts = Array.from(svg.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts.filter((t) => t === expectedText).length).toBe(2);
  });

  it("shows different AU values top vs bottom for an off-axis rotated ellipse", () => {
    const svg = createSvg();
    const aPx = 220;
    const cPx = 90;
    const bPx = Math.sqrt(aPx * aPx - cPx * cPx);
    const ellipse: CometVisualEllipse = { aPx, bPx, cPx, ePx: cPx / aPx, rotationDeg: 35 };
    renderOrbit(svg, ellipse, -1);

    const [topLabel, bottomLabel] = svg.querySelectorAll("text[font-size='9']");
    expect(topLabel.textContent).not.toBe(bottomLabel.textContent);
  });
});

// display:3d draws a Lambert sprite <image> tinted by url(#tint-<hex-without-#>).
const tintRef = (hex) => `url(#tint-${hex.replace(/[^a-z0-9]/gi, "")})`;
const sprite = (svg, hex) => svg.querySelector(`image[filter="${tintRef(hex)}"]`);

describe("renderBody", () => {
  const earth = PLANETS.find((p) => p.name === "Earth");

  it("default shade (3d + day/night): a Sun-rotated sprite image, no separate terminator path", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false);

    const img = sprite(svg, earth.color);
    expect(img).not.toBeNull();
    expect(img.getAttribute("x")).toBe(String(300 - earth.size));
    expect(img.getAttribute("y")).toBe(String(250 - earth.size));
    expect(img.getAttribute("width")).toBe(String(2 * earth.size));
    expect(img.getAttribute("href")).toMatch(/^data:image\/png;base64,/);
    // shading on -> the sprite is rotated so its lit side faces the Sun; it carries the
    // day/night itself, so there is no terminatorShadowPath <path>.
    const deg = (Math.atan2(CENTER - 250, CENTER - 300) * 180) / Math.PI;
    expect(img.getAttribute("transform")).toBe(`rotate(${deg} 300 250)`);
    expect(svg.querySelector("path")).toBeNull();
    expect(svg.querySelector("defs filter#tint-3f7fc4")).not.toBeNull();
    expect(svg.querySelector("circle")).toBeNull();
  });

  it("shade { sphere: false, dayNight: false }: one flat-fill disc, no sprite", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false, { sphere: false, dayNight: false });
    expect(svg.querySelectorAll("circle").length).toBe(1);
    expect(svg.querySelector("circle").getAttribute("fill")).toBe(earth.color);
    expect(svg.querySelector("image")).toBeNull();
    expect(svg.querySelector("path")).toBeNull();
  });

  it("shade { sphere: true, dayNight: false }: the soft (unrotated) sprite, no day/night", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false, { sphere: true, dayNight: false });
    const img = sprite(svg, earth.color);
    expect(img).not.toBeNull();
    expect(img.getAttribute("transform")).toBeNull();
    expect(svg.querySelector("path")).toBeNull();
  });

  it("shade { sphere: false, dayNight: true }: flat disc + the elliptical terminator wash", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false, { sphere: false, dayNight: true });
    expect(svg.querySelector("circle").getAttribute("fill")).toBe(earth.color);
    expect(svg.querySelector("image")).toBeNull();
    expect(svg.querySelector("path").getAttribute("d")).toBe(
      terminatorShadowPath(300, 250, earth.size, TERMINATOR_BOW)
    );
  });

  it("body at CENTER (the Sun): a flat disc even in 3d — it's a light source, not a lit ball", () => {
    const svg = createSvg();
    renderBody(svg, CENTER, CENTER, SUN, false);
    expect(svg.querySelector("path")).toBeNull();
    expect(svg.querySelector("image")).toBeNull();
    const disc = svg.querySelector("circle");
    expect(disc.getAttribute("fill")).toBe(SUN.color);
    expect(disc.getAttribute("cx")).toBe(String(CENTER));
    expect(disc.getAttribute("r")).toBe(String(SUN.size));
  });

  it("appends a label text above the circle when showLabel is true", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, true);

    const label = svg.querySelector("text");
    expect(label).not.toBeNull();
    expect(label.textContent).toBe("Earth");
    // Label y should be above the body (less than circle cy)
    expect(Number(label.getAttribute("y"))).toBeLessThan(250);
  });

  it("does not append a label when showLabel is false", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false);
    expect(svg.querySelector("text")).toBeNull();
  });

  it("defaults showLabel to true when omitted", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth);
    expect(svg.querySelector("text")).not.toBeNull();
  });

  it("label is centered on body x position (text-anchor: middle)", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, true);

    const label = svg.querySelector("text");
    expect(label.getAttribute("text-anchor")).toBe("middle");
    expect(label.getAttribute("x")).toBe("300");
  });
});

describe("renderBodyShadow", () => {
  it("appends one translucent anti-sunward half-disc path (and no circle) for an off-center body", () => {
    const svg = createSvg();
    renderBodyShadow(svg, 300, 250, 10);

    expect(svg.querySelector("circle")).toBeNull();

    const paths = Array.from(svg.querySelectorAll("path"));
    expect(paths.length).toBe(1);

    const [shadow] = paths;
    expect(shadow.getAttribute("fill")).toBe("#05070c");
    const op = Number(shadow.getAttribute("fill-opacity"));
    expect(op).toBe(0.55);
    // The dark region is terminatorShadowPath's geometry — an anti-sunward wash
    // bounded by the elliptical terminator.
    expect(shadow.getAttribute("d")).toBe(terminatorShadowPath(300, 250, 10, TERMINATOR_BOW));
  });

  it("appends nothing for a body at CENTER (the Sun no-op)", () => {
    const svg = createSvg();
    renderBodyShadow(svg, CENTER, CENTER, 12);
    expect(svg.childNodes.length).toBe(0);
  });

  // reach > coreR (Saturn): the elliptical terminator on the core disc, plus a body-width
  // band clipped to a rotated rect and masked to leave the core to the terminator path.
  it("with reach > coreR, appends the core terminator path plus a clipped + masked ring band", () => {
    const svg = createSvg();
    renderBodyShadow(svg, 520, 300, 13, 24);

    // core disc: the same elliptical terminator geometry every lone body gets.
    const corePath = svg.querySelector("path");
    expect(corePath).not.toBeNull();
    expect(corePath.getAttribute("d")).toBe(terminatorShadowPath(520, 300, 13, TERMINATOR_BOW));
    expect(corePath.getAttribute("fill")).toBe("#05070c");

    const defs = svg.querySelector("defs");
    expect(defs).not.toBeNull();

    const clip = defs.querySelector("clipPath#saturn-shadow");
    expect(clip).not.toBeNull();
    const rects = clip.querySelectorAll("rect");
    expect(rects.length).toBe(1);
    const [rect] = rects;
    expect(rect.getAttribute("width")).toBe("24");
    expect(rect.getAttribute("height")).toBe("26");
    expect(rect.getAttribute("y")).toBe("-13");

    const transform = rect.getAttribute("transform");
    expect(transform).toContain("translate(520 300)");
    const rotateMatch = transform.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*\)/);
    expect(rotateMatch).not.toBeNull();
    const expectedDeg = (Math.atan2(300 - CENTER, 520 - CENTER) * 180) / Math.PI;
    expect(Math.abs(Number(rotateMatch[1]) - expectedDeg)).toBeLessThan(1e-6);

    // mask that punches the core out of the ring band.
    const mask = defs.querySelector("mask#saturn-core-cut");
    expect(mask).not.toBeNull();
    const hole = mask.querySelector("circle");
    expect(hole.getAttribute("r")).toBe("13");
    expect(hole.getAttribute("fill")).toBe("#000");

    const overlay = svg.querySelector('circle[clip-path="url(#saturn-shadow)"]');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute("cx")).toBe("520");
    expect(overlay.getAttribute("cy")).toBe("300");
    expect(overlay.getAttribute("r")).toBe("24");
    // coreShaded=false + no shadeColor here -> the flat #05070c wash.
    expect(overlay.getAttribute("fill")).toBe("#05070c");
    expect(overlay.getAttribute("mask")).toBe("url(#saturn-core-cut)");

    const opacity = Number(overlay.getAttribute("fill-opacity"));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });

  it("is still a no-op for a body at CENTER even when a reach arg is given", () => {
    const svg = createSvg();
    renderBodyShadow(svg, CENTER, CENTER, 13, 24);
    expect(svg.childNodes.length).toBe(0);
  });
});

describe("renderSaturn", () => {
  const saturn = PLANETS.find((p) => p.name === "Saturn");

  it("draws the core as a Sun-rotated sprite image (r=13 box), centered on x, y", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn);

    const img = sprite(svg, saturn.color);
    expect(img).not.toBeNull();
    expect(img.getAttribute("x")).toBe(String(520 - 13));
    expect(img.getAttribute("width")).toBe(String(2 * 13));
    expect(img.getAttribute("transform")).toBe(
      `rotate(${(Math.atan2(CENTER - 300, CENTER - 520) * 180) / Math.PI} 520 300)`
    );
    // No plain core circle — the sprite is the core; the only circles are the rings + band.
    expect(svg.querySelector('circle[fill="#e2c58c"]')).toBeNull();
  });

  it("appends the two plain lit ring circles (r 23/18, stroke-width 2/6, fill none, Saturn colour @ 0.8)", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn);

    const rings = svg.querySelectorAll('circle[fill="none"][stroke="#e2c58c"][opacity="0.8"]');
    expect(rings.length).toBe(2);

    const [outer, inner] = rings;
    expect(outer.getAttribute("r")).toBe("23");
    expect(outer.getAttribute("stroke-width")).toBe("2");
    expect(inner.getAttribute("r")).toBe("18");
    expect(inner.getAttribute("stroke-width")).toBe("6");
    for (const ring of rings) {
      expect(ring.getAttribute("stroke")).toBe(saturn.color);
      expect(ring.getAttribute("cx")).toBe("520");
      expect(ring.getAttribute("cy")).toBe("300");
    }
  });

  it("appends the shadow band via the shared helper: defs > clipPath#saturn-shadow plus one clipped translucent overlay circle (r=24)", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn);

    const clip = svg.querySelector("defs clipPath#saturn-shadow");
    expect(clip).not.toBeNull();
    expect(clip.querySelectorAll("rect").length).toBe(1);

    const overlay = svg.querySelector('circle[clip-path="url(#saturn-shadow)"]');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute("r")).toBe("24");
    // 3d: the band matches the sprite's in-hue dark side, not the flat #05070c wash.
    expect(overlay.getAttribute("fill")).toBe("color-mix(in srgb, #e2c58c 28%, black)");

    const opacity = Number(overlay.getAttribute("fill-opacity"));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });

  it("3d + day/night: the core sprite carries the terminator, so only the ring band <path>-free", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn);

    // No terminatorShadowPath <path> on the core — the sprite handles it.
    expect(svg.querySelector("path")).toBeNull();

    const circles = Array.from(svg.querySelectorAll("circle")).filter((c) => !c.closest("defs"));
    // outer ring + inner ring + day/night band (no core circle).
    expect(circles.length).toBe(3);

    const band = svg.querySelector('circle[clip-path="url(#saturn-shadow)"]');
    expect(band).not.toBeNull();
    expect(band.getAttribute("mask")).toBe("url(#saturn-core-cut)");
    expect(circles[circles.length - 1]).toBe(band);
  });

  it("2d + day/night: flat core circle + the elliptical wash + the ring band", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn, { sphere: false, dayNight: true });
    expect(svg.querySelector("image")).toBeNull();
    expect(svg.querySelector('circle[fill="#e2c58c"]')).not.toBeNull();
    expect(svg.querySelector("path").getAttribute("d")).toBe(
      terminatorShadowPath(520, 300, 13, TERMINATOR_BOW)
    );
    expect(svg.querySelector('circle[clip-path="url(#saturn-shadow)"]')).not.toBeNull();
  });

  it("shade { sphere: false, dayNight: false }: just the flat-fill body + two rings", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn, { sphere: false, dayNight: false });
    expect(svg.querySelectorAll("circle").length).toBe(3);
    expect(svg.querySelector("circle").getAttribute("fill")).toBe(saturn.color);
    expect(svg.querySelector('circle[clip-path="url(#saturn-shadow)"]')).toBeNull();
    expect(svg.querySelector("image")).toBeNull();
  });
});

describe("renderSphereSprite / sunBearing", () => {
  it("sunBearing is the screen-space angle to CENTER, null at CENTER", () => {
    expect(sunBearing(CENTER, CENTER)).toBeNull();
    expect(sunBearing(300, 250)).toBeCloseTo(
      (Math.atan2(CENTER - 250, CENTER - 300) * 180) / Math.PI,
      9
    );
  });

  it("emits one tint <filter> per colour (feColorMatrix multiply) and reuses <defs>", () => {
    const svg = createSvg();
    renderSunHalo(svg);
    renderSphereSprite(svg, 300, 250, 8, "#3f7fc4", 40);
    renderSphereSprite(svg, 100, 100, 8, "#3f7fc4", -40);
    renderSphereSprite(svg, 200, 200, 8, "#c04a1f", null);

    expect(svg.querySelectorAll("defs").length).toBe(1);
    expect(svg.querySelectorAll("defs filter#tint-3f7fc4").length).toBe(1);
    expect(svg.querySelectorAll("defs filter#tint-c04a1f").length).toBe(1);

    const fcm = svg.querySelector("defs filter#tint-3f7fc4 feColorMatrix");
    expect(fcm.getAttribute("type")).toBe("matrix");
    // diagonal R,G,B scale = the hue's channels / 255 (0x3f/255, 0x7f/255, 0xc4/255)
    const vals = fcm.getAttribute("values").trim().split(/\s+/).map(Number);
    expect(vals[0]).toBeCloseTo(0x3f / 255, 5);
    expect(vals[6]).toBeCloseTo(0x7f / 255, 5);
    expect(vals[12]).toBeCloseTo(0xc4 / 255, 5);
  });

  it("uses SPRITE_LIT (rotated) when a bearing is given, SPRITE_SOFT (unrotated) when null", () => {
    const svg = createSvg();
    renderSphereSprite(svg, 300, 250, 8, "#3f7fc4", 40);
    renderSphereSprite(svg, 100, 100, 8, "#c04a1f", null);
    const [lit, soft] = Array.from(svg.querySelectorAll("image"));
    expect(lit.getAttribute("transform")).toBe("rotate(40 300 250)");
    expect(soft.getAttribute("transform")).toBeNull();
    // Different sprite data for lit vs soft.
    expect(lit.getAttribute("href")).not.toBe(soft.getAttribute("href"));
    expect(lit.getAttribute("href")).toMatch(/^data:image\/png;base64,/);
  });
});

describe("renderSunHalo", () => {
  it("appends a <defs> holding a <radialGradient id='sun-halo'> with ≥ 3 stops, last fully transparent", () => {
    const svg = createSvg();
    renderSunHalo(svg);

    const defs = svg.querySelector("defs");
    expect(defs).not.toBeNull();

    const gradient = defs.querySelector("radialGradient#sun-halo");
    expect(gradient).not.toBeNull();

    const stops = gradient.querySelectorAll("stop");
    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops[stops.length - 1].getAttribute("stop-opacity")).toBe("0");
  });

  it("appends exactly one halo circle (id='sun-halo-glow') at CENTER, sized to the full view", () => {
    const svg = createSvg();
    renderSunHalo(svg);

    const halos = svg.querySelectorAll('circle[fill="url(#sun-halo)"]');
    expect(halos.length).toBe(1);

    const [halo] = halos;
    expect(halo.getAttribute("id")).toBe("sun-halo-glow");
    expect(halo.getAttribute("cx")).toBe(String(CENTER));
    expect(halo.getAttribute("cy")).toBe(String(CENTER));
    // Initial radius covers HALO_VIEW_FRACTION of the un-zoomed 800px view.
    expect(Number(halo.getAttribute("r"))).toBe(VIEW_SIZE * HALO_VIEW_FRACTION);
    expect(Number(halo.getAttribute("r"))).toBeGreaterThan(SUN.size);
  });
});
