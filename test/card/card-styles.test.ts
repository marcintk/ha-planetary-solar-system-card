import { describe, expect, it } from "vitest";
import { cardStyles } from "../../src/card/card-styles.js";

// cardStyles is a Lit CSSResult; .cssText is the raw stylesheet string.
// Snapshotting it catches any structural CSS change (column sizes, layout,
// colors) that no dedicated assertion covers.
describe("cardStyles", () => {
  it("matches snapshot", () => {
    expect(cardStyles.cssText).toMatchSnapshot();
  });
});
