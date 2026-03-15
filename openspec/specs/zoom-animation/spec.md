### Requirement: Configurable zoom animation

The card SHALL accept a `zoom_animate` configuration option (boolean, default: `true`) that controls
whether zoom level transitions are animated or instant. When `zoom_animate` is `true`, zoom changes
SHALL smoothly interpolate the SVG `viewBox` from the current dimensions to the target dimensions.
When `zoom_animate` is `false`, zoom changes SHALL apply instantly as a single step (existing
behavior).

#### Scenario: Default zoom_animate is true

- **WHEN** the card is configured without a `zoom_animate` option
- **THEN** zoom level changes SHALL be animated

#### Scenario: Zoom animation disabled

- **WHEN** the card is configured with `zoom_animate: false`
- **THEN** zoom level changes SHALL apply instantly without animation

### Requirement: Animated zoom transition duration

When `zoom_animate` is enabled, each zoom transition SHALL complete in approximately 2000
milliseconds. The animation SHALL use an ease-in-out timing function to create a natural
acceleration and deceleration effect.

#### Scenario: Animation completes in approximately 2 seconds

- **WHEN** `zoom_animate` is `true` and the user triggers a zoom change
- **THEN** the viewBox transition SHALL complete in approximately 2000ms
- **AND** the viewport SHALL reach the exact target dimensions at the end of the animation

#### Scenario: Ease-in-out timing creates smooth acceleration

- **WHEN** `zoom_animate` is `true` and a zoom animation is in progress
- **THEN** the viewport size change SHALL be slow at the start, fast in the middle, and slow at the
  end

### Requirement: ViewBox interpolation during animation

During an animated zoom, the SVG `viewBox` width and height SHALL be interpolated from the current
values to the target zoom level values using `requestAnimationFrame`. The `viewBox` center position
(centerX, centerY) SHALL remain unchanged during the animation. The zoom level number display SHALL
update immediately to the target level when animation starts.

#### Scenario: ViewBox interpolates smoothly between levels

- **WHEN** `zoom_animate` is `true` and zoom changes from level 1 (width 800) to level 2 (width 640)
- **THEN** the viewBox width SHALL pass through intermediate values between 800 and 640 during the
  animation
- **AND** the viewBox height SHALL interpolate identically to the width

#### Scenario: Pan position preserved during animation

- **WHEN** the user has panned the view and triggers an animated zoom
- **THEN** the viewBox centerX and centerY SHALL remain at their current values throughout the
  animation

#### Scenario: Zoom level display updates immediately

- **WHEN** `zoom_animate` is `true` and a zoom change is triggered
- **THEN** the zoom level number in the navigation bar SHALL update to the target level immediately
- **AND** the zoom level number SHALL NOT animate or show intermediate values

### Requirement: Interruptible zoom animation

When a new zoom change is triggered while an animation is in progress, the current animation SHALL
be cancelled. The new animation SHALL start from the current interpolated viewport position (not the
original start or previous target).

#### Scenario: New zoom cancels in-progress animation

- **WHEN** `zoom_animate` is `true` and an animation is in progress from level 1 to level 2
- **AND** the user triggers zoom-in again (to level 3) before the first animation completes
- **THEN** the first animation SHALL stop
- **AND** a new animation SHALL begin from the current interpolated width to the level 3 target
  (320)

#### Scenario: Rapid zoom clicks produce smooth result

- **WHEN** `zoom_animate` is `true` and the user clicks zoom-in rapidly multiple times
- **THEN** each click SHALL cancel the previous animation and start a new one from the current
  position
- **AND** the final animation SHALL end at the correct target zoom level

### Requirement: No animation on initial render

The zoom animation SHALL NOT apply during the initial card render or when `setConfig()` triggers a
full re-render. Animation SHALL only apply to zoom changes after the card is connected and rendered.

#### Scenario: Initial render uses instant zoom

- **WHEN** the card is first rendered with `default_zoom: 3` and `zoom_animate: true`
- **THEN** the viewBox SHALL be set immediately to level 3 dimensions (480x480) without animation

#### Scenario: Config change re-render is instant

- **WHEN** `setConfig()` is called with a new `default_zoom` value
- **THEN** the re-render SHALL apply the new zoom level instantly without animation
