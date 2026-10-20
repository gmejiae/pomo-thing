<p align="center">
  <img src="apps/pomo/public/icon.svg" width="128" height="128" alt="Pomo icon">
</p>

<h1 align="center">pomo-thing</h1>

<p align="center"><strong>Pomo</strong>: a Pomodoro timer with a little companion, Mochi, for the Spotify Car Thing running <a href="https://bridgething.com">bridgething</a>.</p>

<p align="center">
  <img src="apps/pomo/screenshots/01-timer.png" width="400" alt="Pick a block">
  <img src="apps/pomo/screenshots/02-focus.png" width="400" alt="Focus running">
  <img src="apps/pomo/screenshots/03-tickle.png" width="400" alt="Tickling Mochi">
  <img src="apps/pomo/screenshots/04-progress.png" width="400" alt="Daily progress and streak">
  <img src="apps/pomo/screenshots/05-celebrate.png" width="400" alt="Block finished">
  <img src="apps/pomo/screenshots/06-tour.png" width="400" alt="Welcome tour">
</p>

- Suggests focus and break blocks, with presets (25/5, 50/10, 15/3) and the knob to adjust minutes.
- Mochi chats, fidgets, jumps when tapped and laughs when tickled. Its sprout grows with every pomodoro and blooms at your daily goal.
- Daily count, streak and a 7-day chart.
- Optional macOS notification with sound when a block ends (desktop extension, `osascript`).
- Spanish and English.

## Install

Add this source in the bridgething app: `https://gmejiae.github.io/pomo-thing/catalog.v1.json`

The desktop extension only asks for `run:osascript`, to show the notification.

## Develop

```sh
bun run dev            # develop against a connected Car Thing
bun run dev:device     # show the dev server on the Car Thing screen
bun run push           # build and install to the device
bun run check          # typecheck, build and validate the catalog
```

Pushing to `main` publishes to the `gh-pages` branch (Settings > Pages: branch `gh-pages`, folder `/ (root)`).
