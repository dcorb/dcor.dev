# dcor.dev

Personal site of David Corbacho Román. Plain static HTML, CSS and JS, no framework and no build step.

- `index.html`: all content (Home and Work tabs)
- `assets/terrain.js`: WebGL ridgeline background and its tuning panel
- `assets/app.js`: tabs, Work sidebar, email reveal, Vercel Web Analytics
- `vercel.json`: static output, clean URLs, security headers

Run locally: `python3 -m http.server 4321` (or `vercel dev`), then open http://localhost:4321
