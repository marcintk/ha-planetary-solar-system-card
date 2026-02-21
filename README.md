## Summary

Home Assistant custom Lovelace card (`ha-solar-view-card`) that displays a planetary solar system. 

Shows alignment of all 8 planets and Moon centered on the Sun for a given date, with interactive navigation (day/month forward/back, return to today).

It automatically updates the view every 60 seconds.

## Development

This is AI generated project with use of specification ([openspec](https://github.com/Fission-AI/OpenSpec)) to implement enhacement or fix issues. 

More on development in [CLAUDE.md](CLAUDE.md).

## Installation

This can be installed in Home Assistant as:
- copy JavaScript file (dist/ha-solar-view-card.js) to the folder: `<config directory>/www/ha-solar-view-card/ha-solar-view-card.js` i.e. via Terminal.
- add the following to your Home Assistant Dashboard resources configuration:

    ```yaml
    resources:
    - url: /local/ha-solar-view-card/ha-solar-view-card.js?hacstag=1
      type: JavaScript Module
    ```
- restart Home Assistant
- on dashboard card, add below to complete the visualization:

    ```yaml
    - type: custom:ha-solar-view-card
    ```

### Example:

![Example of the display](example.png)

## TODO:

### Features
- add WINTER/SPRING/SUMMER/FALL split
- orbit around Moon
- diplay a zoom level number
- add some Comets i.e. Halley
- add customization via configuration
- revisit buttons: <<<,<<,<,today, >,>>,>>>, CurrentTime, +, -.
- add Earth centric view (every update should move all objects except Earth)
- add moon phases

### Fixes
- better zoom on start
- sometimes Moon is on Venus position
- Earth needle is too long (or revisit a visibility cone)
- no margins between card and VIEW
- card background is too dark