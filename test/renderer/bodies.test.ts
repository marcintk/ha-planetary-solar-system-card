import { describe, expect, it } from "vitest";
import { PLANETS, SUN } from "../../src/astronomy/planet-data.js";
import {
  HALO_VIEW_FRACTION,
  ORBIT_COLOR,
  renderBody,
  renderBodyShadow,
  renderOrbit,
  renderSaturn,
  renderSphere3d,
  renderSphere3dDef,
  renderSunHalo,
} from "../../src/renderer/bodies.js";
import {
  CENTER,
  radiusFromAU,
  SVG_NS,
  sunwardHalfDiscPaths,
  VIEW_SIZE,
} from "../../src/renderer/svg-utils.js";
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

describe("renderBody", () => {
  const earth = PLANETS.find((p) => p.name === "Earth");

  it("default shade: base disc + centred #sphere-3d overlay + the day/night half-disc path", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false);

    const base = svg.querySelector("circle");
    expect(base.getAttribute("cx")).toBe("300");
    expect(base.getAttribute("cy")).toBe("250");
    expect(base.getAttribute("r")).toBe(String(earth.size));
    expect(base.getAttribute("fill")).toBe(earth.color);

    // 3d ball: a plain (un-rotated) circle filled with the centred gradient.
    expect(svg.querySelector("g")).toBeNull();
    const ball = svg.querySelector('circle[fill="url(#sphere-3d)"]');
    expect(ball).not.toBeNull();
    expect(ball.getAttribute("cx")).toBe("300");
    expect(ball.getAttribute("r")).toBe(String(earth.size));

    // day/night: a distinct translucent half-disc over the anti-sunward hemisphere.
    const paths = Array.from(svg.querySelectorAll("path"));
    expect(paths.length).toBe(1);
    expect(paths[0].getAttribute("fill")).toBe("#05070c");
    expect(paths[0].getAttribute("d")).toBe(sunwardHalfDiscPaths(300, 250, earth.size).darkD);
    const op = Number(paths[0].getAttribute("fill-opacity"));
    expect(op).toBeGreaterThan(0);
    expect(op).toBeLessThan(1);
  });

  it("shade { sphere: false, dayNight: false }: base disc only", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false, { sphere: false, dayNight: false });
    expect(svg.querySelectorAll("circle").length).toBe(1);
    expect(svg.querySelector('circle[fill="url(#sphere-3d)"]')).toBeNull();
    expect(svg.querySelector("path")).toBeNull();
  });

  it("shade { sphere: true, dayNight: false }: base disc + ball, no day/night path", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false, { sphere: true, dayNight: false });
    expect(svg.querySelector('circle[fill="url(#sphere-3d)"]')).not.toBeNull();
    expect(svg.querySelector("path")).toBeNull();
  });

  it("appends a plain circle (no ball, no path) for a body at CENTER, e.g. the Sun", () => {
    const svg = createSvg();
    renderBody(svg, CENTER, CENTER, SUN, false);

    expect(svg.querySelector("path")).toBeNull();
    expect(svg.querySelector('circle[fill="url(#sphere-3d)"]')).toBeNull();

    const circle = svg.querySelector("circle");
    expect(circle.getAttribute("cx")).toBe(String(CENTER));
    expect(circle.getAttribute("cy")).toBe(String(CENTER));
    expect(circle.getAttribute("r")).toBe(String(SUN.size));
    expect(circle.getAttribute("fill")).toBe(SUN.color);
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
    expect(op).toBe(0.45);
    // The dark half-disc is the same geometry sunwardHalfDiscPaths returns — a distinct terminator.
    expect(shadow.getAttribute("d")).toBe(sunwardHalfDiscPaths(300, 250, 10).darkD);
  });

  it("appends nothing for a body at CENTER (the Sun no-op)", () => {
    const svg = createSvg();
    renderBodyShadow(svg, CENTER, CENTER, 12);
    expect(svg.childNodes.length).toBe(0);
  });

  // reach > coreR (Saturn): instead of the plain <path> half-disc, the shadow is a
  // band clipped to a rotated rect that reaches from the body centre out to `reach`.
  it("with reach > coreR, appends a clipPath rect band and a clipped translucent circle (no path)", () => {
    const svg = createSvg();
    renderBodyShadow(svg, 520, 300, 13, 24);

    expect(svg.querySelector("path")).toBeNull();

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

    const overlay = svg.querySelector('circle[clip-path="url(#saturn-shadow)"]');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute("cx")).toBe("520");
    expect(overlay.getAttribute("cy")).toBe("300");
    expect(overlay.getAttribute("r")).toBe("24");
    expect(overlay.getAttribute("fill")).toBe("#05070c");

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

  it("appends a plain body circle first (r=13, Saturn's colour), centered on x, y", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn);

    const firstCircle = svg.querySelector("circle");
    expect(firstCircle).not.toBeNull();
    expect(firstCircle.getAttribute("r")).toBe("13");
    expect(firstCircle.getAttribute("fill")).toBe(saturn.color);
    expect(firstCircle.getAttribute("cx")).toBe("520");
    expect(firstCircle.getAttribute("cy")).toBe("300");
  });

  it("appends the two plain lit ring circles (r 23/18, stroke-width 2/6, fill none, Saturn colour @ 0.6)", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn);

    const rings = svg.querySelectorAll('circle[fill="none"][stroke="#e2c58c"][opacity="0.6"]');
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
    expect(overlay.getAttribute("fill")).toBe("#05070c");

    const opacity = Number(overlay.getAttribute("fill-opacity"));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });

  it("draws body circle, both rings, the clipped day/night band, then the #sphere-3d ball last", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn);

    // body + outer ring + inner ring + day/night band + sphere-3d core overlay
    const circles = Array.from(svg.querySelectorAll("circle"));
    expect(circles.length).toBe(5);

    const body = circles[0];
    expect(body.getAttribute("fill")).toBe(saturn.color);
    expect(body.getAttribute("r")).toBe("13");

    const band = svg.querySelector('circle[clip-path="url(#saturn-shadow)"]');
    expect(band).not.toBeNull();

    // The 3d ball is a plain circle (no rotation), and it is Saturn's last element.
    const ball = circles[circles.length - 1];
    expect(ball.getAttribute("fill")).toBe("url(#sphere-3d)");
    expect(Number(ball.getAttribute("r"))).toBe(13);
    expect(svg.querySelector("g")).toBeNull();

    const rings = Array.from(
      svg.querySelectorAll('circle[fill="none"][stroke="#e2c58c"][opacity="0.6"]')
    );
    const bodyIdx = circles.indexOf(body);
    const bandIdx = circles.indexOf(band);
    for (const ring of rings) {
      const ringIdx = circles.indexOf(ring);
      expect(ringIdx).toBeGreaterThan(bodyIdx);
      expect(ringIdx).toBeLessThan(bandIdx);
    }
    expect(bandIdx).toBe(circles.length - 2);
  });

  it("shade { sphere: false, dayNight: false }: just the body + two rings", () => {
    const svg = createSvg();
    renderSaturn(svg, 520, 300, saturn, { sphere: false, dayNight: false });
    expect(svg.querySelectorAll("circle").length).toBe(3);
    expect(svg.querySelector('circle[clip-path="url(#saturn-shadow)"]')).toBeNull();
    expect(svg.querySelector('circle[fill="url(#sphere-3d)"]')).toBeNull();
  });
});

describe("renderSphere3dDef", () => {
  it("appends a <defs> with one centred <radialGradient id='sphere-3d'>: bright centre, dark rim", () => {
    const svg = createSvg();
    renderSphere3dDef(svg);

    const grad = svg.querySelectorAll("defs radialGradient#sphere-3d");
    expect(grad.length).toBe(1);

    // Centred — no offset focal point.
    expect(grad[0].getAttribute("cx")).toBe("0.5");
    expect(grad[0].getAttribute("cy")).toBe("0.5");
    expect(grad[0].getAttribute("fx")).toBeNull();

    const stops = Array.from(grad[0].querySelectorAll("stop"));
    expect(stops.length).toBeGreaterThanOrEqual(3);
    // Bright highlight at the centre.
    expect(stops[0].getAttribute("stop-color")).toBe("#ffffff");
    // Dark at the rim, but translucent — not black.
    expect(stops[stops.length - 1].getAttribute("stop-color")).toBe("#05070c");
    const rim = Number(stops[stops.length - 1].getAttribute("stop-opacity"));
    expect(rim).toBeGreaterThan(0);
    expect(rim).toBeLessThan(1);
  });

  it("reuses the existing <defs> rather than adding a second one", () => {
    const svg = createSvg();
    renderSunHalo(svg);
    renderSphere3dDef(svg);
    expect(svg.querySelectorAll("defs").length).toBe(1);
  });
});

describe("renderSphere3d", () => {
  it("appends a plain circle filled with the centred gradient — no rotation group", () => {
    const svg = createSvg();
    renderSphere3d(svg, 520, 300, 13);

    expect(svg.querySelector("g")).toBeNull();
    const circle = svg.querySelector("circle");
    expect(circle.getAttribute("cx")).toBe("520");
    expect(circle.getAttribute("cy")).toBe("300");
    expect(circle.getAttribute("r")).toBe("13");
    expect(circle.getAttribute("fill")).toBe("url(#sphere-3d)");
  });

  it("is a no-op for a body at CENTER (the Sun)", () => {
    const svg = createSvg();
    renderSphere3d(svg, CENTER, CENTER, 16);
    expect(svg.childNodes.length).toBe(0);
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
