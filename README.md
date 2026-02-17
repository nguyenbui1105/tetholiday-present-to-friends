# Chu Song

A single-page emotional web experience. Pure HTML + CSS + Vanilla JS.

## Run locally

Open `index.html` with VS Code Live Server or any static file server.

## Dev flags

Append query parameters to the URL:

| Flag | Effect |
|------|--------|
| `?dev` | Enable debug logs and visibility assertions in console |
| `?dev&reset=1` | Also clear localStorage (envelope picks + claimed status) for a fresh run |

These flags have **no effect** in production (normal URL without `?dev`).

## One-time reward behavior

- Each player picks one envelope per `playerKey` (persisted in localStorage)
- Revisiting the reward screen shows the same result, not the envelope picker
- After form submission, the player is marked as claimed and goes straight to the end screen
