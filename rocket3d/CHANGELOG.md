# Rocket 3D — Change history

## 2026-10-11 — Pop-up entrance when selecting a rocket

**Files:** `rocket3d/common.js`, `assets/customize.js`, `rocket3d/viewer.js`.

- Added a reusable 940 ms spring-like vertical entrance on the model's outer THREE.Group; individual parts and their saved local offsets are unaffected.
- Runs on initial load and switching between Falcon 9, Falcon Heavy, and Saturn V in Customize and Whole Rocket viewer; reselecting the current rocket replays it.
- Also runs when selecting a part-gallery module and returning to a previously selected tab/model.
- Stops and restores its exact original transform on camera manipulation, disassembly control use, tab switches, and model disposal.
- Respects `prefers-reduced-motion: reduce` (no entrance animation).
- Does not change paint, variants, slots, assembly state, or stored settings.
- QA: three edited JS files parsed successfully; entrance easing, exact settling, replay, interruption, and reduced-motion behavior checked with a deterministic simulated animation-frame test.
- Still recommended: physical iPhone/iPad and desktop visual smoke test after GitHub Pages deployment.

**For future AI collaborators:** Only one agent should work on or deploy a shared branch at a time. Review recent commits/PRs before changing animation, camera, loading, or disassembly behavior.
