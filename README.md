# Zombie Survival — Level 1: First Night

A portrait-first, top-down survival shooter built as an offline-capable PWA for phones (designed for iPhone touch in portrait). The player escapes a wrecked bus, scavenges a highway rest stop, pushes through a collapsed overpass and up Maple Street, then holds the clinic courtyard for 90 seconds while the generator powers the gate.

The game, art and music are all original and made in code. There are no third-party assets and no runtime dependencies.

- **Game:** plain JavaScript ES modules on HTML5 canvas, with a fixed 60 Hz simulation.
- **Art:** procedural. Characters, vehicles, buildings and neon signs are drawn with canvas paths. Lighting is a darkness layer with a shadow-casting flashlight cone, fires and flickering signs.
- **Music:** composed in `src/js/music.js` and rendered by `src/js/synth.js` into eight synced, looping MP3 stems (ambience, tension, combat, boss and four hold-out layers).
- **Sound effects:** synthesized at startup with the same DSP code. That code can also re-render any music stem in the browser if a file fails to decode.

## Play

| Input | Touch | Mouse + keyboard | Gamepad |
|---|---|---|---|
| Move | Left virtual stick (bottom-left) | WASD | Left stick |
| Aim / fire | Right stick (fires past 30% push) | Mouse / left click | Right stick / RT |
| Reload | Tap ammo counter | R | X |
| Dodge roll | Double-tap left stick | Space | B |
| Sprint | Push left stick to edge | Shift (hold) | LS click |
| Interact | Hold the button near an object | E (hold) | Y (hold) |
| Swap weapon | Tap weapon icon | 1 / 2 / 3 or wheel | D-pad |
| Heal | Tap bandage / medkit | Q / C | LB / RB |

The sticks appear wherever a thumb lands in the bottom 35% of the screen. Pause (top right, Esc or Start) opens a controls reminder plus the aim-assist, music and SFX settings.

## Develop

Requires Node 18 or later. There is nothing to install.

```sh
node tools/serve.mjs src 8080        # play the source directly at http://localhost:8080/
node tests/spec-check.mjs            # headless spec checks (economy, spawns, beats, checkpoint, hold-out)
node build.mjs                       # outputs the static site to dist/
node tools/serve.mjs dist 8080 /zs-/ # test the build under a GitHub Pages-style subpath
```

Asset tools (their output is committed, so you only need these to change assets):

```sh
node tools/render-audio.mjs          # re-render src/audio/*.mp3 from music.js (needs ffmpeg + libmp3lame)
node tools/make-icons.mjs            # re-draw src/icons/*.png (needs Playwright)
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs the spec checks, builds `dist/` and deploys it on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

All paths are relative: the manifest `start_url`, the service worker scope and every asset. The site therefore works from the repository subpath (`https://<user>.github.io/<repo>/`).

`build.mjs` stamps the service worker with a content-hashed cache version and the full pre-cache list. Every release therefore installs a fresh cache. Installed copies show **"Update ready"** and switch to the new version on their next launch.

## Project layout

```
src/
  index.html, styles.css, manifest.webmanifest, sw.js
  audio/        rendered music stems (MP3, ~2.4 MB)
  icons/        192 / 512 / maskable / apple-touch icons
  js/
    main.js     boot, screens, loop, lifecycle (pause on background, wake lock)
    game.js     simulation: player, enemy AI, weapons, beats, prompts, spawns, checkpoint, hold-out
    level.js    the map: zones, geometry, props, lights, pickups, placements, spawn pools
    world.js    0.5 m collision grid, line of sight, ray casts, flow-field pathing
    render.js   procedural art + lighting        hud.js   HUD + touch hit regions
    input.js    twin sticks, keyboard/mouse, gamepad
    audio.js    Web Audio mixer (synced stems, positional SFX)
    synth.js / music.js / sfx.js   DSP toolkit, score, sound recipes
    config.js   tuning values from the spec    save.js  local save    pwa.js  SW + wake lock
tests/spec-check.mjs   headless acceptance checks
```

## Spec notes and interpretations

- **Enemy and ammo counts:** 44 Walkers, 17 Runners and 1 Brute. The level holds 132 pistol rounds, 30 shells and 4 medkits. `tests/spec-check.mjs` verifies these with a scripted run through all seven beats.
- **Spawn rule:** an enemy only spawns at least 18 m from the player and out of line of sight. "Line of sight" means an unobstructed line within 30 m; nothing past that range is visible at night. Enemies placed in the level at the start of a zone are dormant set-dressing; later placements go through the same spawn check.
- **Aim assist:** 15° is treated as the half-angle of the snap cone. It applies to touch aiming only and can be toggled in the pause menu.
- **Healing:** the spec gives no controls for using bandages and medkits. They are tap buttons above the left thumb zone, Q / C on keyboard, and LB / RB on gamepad.
- **Brute:** the courtyard's south entrance is a narrow gap beside a wrecked ambulance, too tight for the Brute. It can be fought in the square or avoided, and if it loses you it leashes back.
- **Not verified here:** the acceptance items that need real devices or playtesters — frame rate on reference phones, completion time and attempt rates. A rolling frame-time monitor lowers render resolution on slow devices.
