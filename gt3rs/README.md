# 911 GT3 RS — dealer showcase

A scroll-driven, real-time 3D product site for the Porsche 911 GT3 RS (992), built for an
independent dealer. Carbon-black palette with acid-green accents.

- **3D hero** – a real-time GT3 RS on a studio turntable; the camera flies to each feature as you scroll
- **Performance** – animated headline figures
- **Engineering** – four chapters (front axle, DRS wing, engine, cooling)
- **Configurator** – live paint and wheel finishes, drag to rotate
- **Gallery** – stills rendered in the browser from the same model
- **Enquiry form** – validated; set `data-endpoint="https://…"` on `#enquireForm` to deliver submissions

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/ – host anywhere
```

## Stack

Vite, three.js, GSAP ScrollTrigger, Lenis. No framework.

## Before going live

- Replace the placeholder dealer name ("Apex Nine"), phone and email in `index.html`.
- Point the enquiry form at a real endpoint (see above); without one it only shows the confirmation.
- Keep the footer disclaimer and the 3D model credit — the model licence (CC BY 4.0) requires attribution.

## Credits

3D model: "Porsche 911 GT3 RS Snow Edition" by Drifter Models, CC BY 4.0 — see
`public/models/CREDITS.txt`. Optimised (Draco / WebP) and recoloured at runtime.
