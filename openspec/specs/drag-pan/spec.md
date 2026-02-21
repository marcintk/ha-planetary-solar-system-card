### Requirement: Drag to pan the viewport
The user SHALL be able to click and drag on the SVG solar view to pan the viewport. Dragging SHALL move the visible area in the direction of the drag, translating the viewBox origin accordingly.

#### Scenario: Drag right moves view right
- **WHEN** the user clicks on the SVG and drags 50 pixels to the right
- **THEN** the viewBox origin SHALL shift left (decreasing minX) so that the visible content appears to move right, proportional to the current zoom level

#### Scenario: Drag up moves view up
- **WHEN** the user clicks on the SVG and drags 50 pixels upward
- **THEN** the viewBox origin SHALL shift down (decreasing minY) so that the visible content appears to move upward, proportional to the current zoom level

### Requirement: Drag uses pointer events
The drag interaction SHALL use `pointerdown`, `pointermove`, and `pointerup` events with `setPointerCapture` on the SVG element.

#### Scenario: Drag tracking with pointer capture
- **WHEN** the user presses down on the SVG
- **THEN** the SVG element SHALL call `setPointerCapture` on the pointer ID so that move and up events are received even if the pointer leaves the SVG bounds

#### Scenario: Drag ends on pointer up
- **WHEN** the user releases the pointer after dragging
- **THEN** the drag operation SHALL end and subsequent pointer movement SHALL NOT affect the viewport

### Requirement: Drag distance scales with zoom level
The pan distance in SVG coordinates SHALL be proportional to the current viewBox dimensions, so that dragging the same screen distance produces consistent visual movement regardless of zoom level.

#### Scenario: Drag at 2x zoom moves half the SVG distance
- **WHEN** the viewBox is zoomed to show half the default area (viewWidth is half of auto-fit width) and the user drags 100 screen pixels
- **THEN** the viewBox SHALL shift by a distance corresponding to 100 pixels in the current viewport scale (smaller SVG-coordinate shift than at 1x zoom)

### Requirement: Drag cursor feedback
The SVG element SHALL show a `grab` cursor when hovering and a `grabbing` cursor while actively dragging.

#### Scenario: Cursor changes on drag start
- **WHEN** the user hovers over the SVG
- **THEN** the cursor SHALL display as `grab`

#### Scenario: Cursor changes during drag
- **WHEN** the user is actively dragging (pointer is down and moving)
- **THEN** the cursor SHALL display as `grabbing`

### Requirement: Drag does not trigger text selection
The SVG element SHALL have `user-select: none` and `touch-action: none` CSS properties to prevent text selection and browser touch gestures from interfering with drag.

#### Scenario: No text selection during drag
- **WHEN** the user drags across the SVG containing planet labels
- **THEN** no text selection SHALL occur on the labels or surrounding elements
