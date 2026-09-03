# Scene objects — SOP

How to add a new physics object to the spike scene (logos, nav buttons, later:
page sections). Objects share the letters' constraints — plane-locked rapier
bodies rendered through the ascii pass — but bring their own shape, colour and
(optionally) a click action.

## TL;DR checklist

1. Drop the artwork in `frontend/public/logos/<name>.svg` (baked-in `fill`s, no
   strokes, tight viewBox).
2. Add `spike/objects/<name>.js` — a default-exported descriptor.
3. Register it in `spike/objects/index.js`.
4. Tune `collider` and `spawn` by eye.

Nothing else. No shader edits for a new colour, no per-object component.

---

## 1. The shared contract

`spike/SceneObject.jsx` **is** the abstraction. It's a plane-locked `RigidBody`
(`colliders={false}`) + a collider + an optional invisible hit target. Letters,
logos and buttons are all `<SceneObject>` + visual-mesh children — you never
rewrite the body.

| trait                | value                        | source                                                 |
| -------------------- | ---------------------------- | ------------------------------------------------------ |
| `enabledTranslations`| `[true, true, false]`        | XY plane only, z pinned to the drag plane              |
| `enabledRotations`   | `[false, false, true]`       | spin about z only                                      |
| position z           | `0`                          | every object coplanar                                  |
| restitution / friction / damping | `config.BODY`    | one shared feel                                        |
| extrude depth        | `DEPTH` (`0.9`, `config.js`) | uniform thickness so the sun / two-tone reads the same |
| bounds               | the shared `Pit`             | floor + width-tracking side walls                      |
| spawn                | above the frame (`y ≳ 7`)    | object drops in, same as GRAEME                        |

`SceneObject` props: `collider` (`{shape:'cuboid',half:[x,y,z]}` |
`{shape:'ball',radius}`), `position` `[x,y]`, `spin`, `ccd`, `grabbable`,
`onClick`, `children`. Interactive (`grabbable` or `onClick`) ⇒ it renders the
hit mesh and wires `grabOrClick`.

`descriptor.depth` overrides the extrude depth for one object; **`descriptor.scale`
does not touch depth** — only x/y. That's what keeps "same depth" true.

---

## 2. The descriptor

`spike/objects/github.js`:

```js
import { DEPTH } from '../config'

export default {
  name: 'github',                              // unique; used as React key
  src: '/logos/github.svg',                    // under frontend/public/
  scale: 1.4,                                  // uniform x/y; applied AFTER the
                                               // artwork is normalised to ~1 unit tall
  depth: DEPTH,                                // optional override
  shading: 'flat',                             // 'flat' (per-svg colour) | 'two-tone'
  collider: { shape: 'ball', radius: 0.7 },    // or { shape: 'cuboid', half: [w, h, DEPTH / 2] }
  spawn: { x: -3, y: 14, spin: 0.15 },
  ccd: true,                                   // fast small objects only
  level: 1,                                    // stage — drops in at level*STAGE_MS (default 1)
  to: 'https://github.com/<user>',             // OPTIONAL — presence makes it clickable
}
```

### `to` — click behaviour

Present `to` ⇒ the object is a button. A **tap** (pointer barely moved) fires;
a **drag** always just flings.

| `to` value        | action                                  |
| ----------------- | --------------------------------------- |
| `-1` (number)     | `navigate(-1)` — back button            |
| `'/projects'`     | `navigate('/projects')` — in-app route  |
| `'https://…'`     | `window.open(to, '_blank', 'noopener')` |

Omit `to` ⇒ grab / fling only (plain logo).

### `shading`

- `'flat'` (default): each SVG `<path>` is coloured by its own `fill` via
  `surfaceColor(hex)`. The camera-facing cap keeps the colour; extruded side
  faces are darkened by `SIDE_MUL` (`asciiShader.js`, ~0.62) so depth reads.
  **A new brand colour needs no shader change.**
- `'two-tone'`: whole object uses `SURFACE_TWO_TONE` — sun-shaded against the
  global `ink` / `inkDark`, SVG colours ignored. **Required for black / near-
  black silhouettes** — flat mode runs colours through a 0.5-pivot contrast in
  the ascii pass, so pure black collapses to nothing. GitHub + the arrows use
  this; only LinkedIn is `'flat'`.

### Multi-colour logos

One `<path>` per fill colour, in paint order (first = back). The loader lifts
each later path slightly forward (`layer * depth * 0.05`) so an overlapping fill
(white lettering on a coloured tile) doesn't z-fight. A compound single path
with winding holes also works, but holes render as empty (background shows
through), not as a second colour — split it if you want the counter filled. See
`public/logos/linkedin.svg`: path 1 = `#89CFF0` tile, path 2 = white `in`.

---

## 3. SVG prep

- Location: `frontend/public/logos/`.
- **Baked fills.** `path.color` only reads presentation attributes / inline
  `style="fill:…"`. `currentColor`, CSS classes, `<defs>` won't resolve —
  flatten fills first.
- **No strokes.** Stroke geometry is dropped. Convert outline icons to filled
  paths (Inkscape: *Path → Stroke to Path*).
- **Tight viewBox.** The loader normalises the artwork bounding box to ~1 unit
  tall, then applies `scale`. Padding in the viewBox throws off `scale` and the
  collider fit.
- **Drop decoy rects.** Icons often ship a `<path ... fill="none"/>` bounding
  box; `build()` skips `fill: none`, but strip it anyway.
- See `## 2 → Multi-colour logos` for splitting fills.

---

## 4. Colliders

Authored in **post-normalise units**: the artwork is ~1 unit tall *before*
`scale`, so a full-height object at `scale: 1.4` is ~`1.4` tall.

- Circular logos → `{ shape: 'ball', radius: <~half the visual size> }`
  (e.g. GitHub mark at `scale: 1.4` ≈ `radius: 0.7`).
- Everything else → `{ shape: 'cuboid', half: [halfW, halfH, DEPTH / 2] }`.

Tune by eye against the rendered glyphs. If unsure, `SceneObject` logs the
extrude bbox in dev — read the x/y size and halve.

---

## 5. Registry & wiring

`spike/objects/index.js`:

```js
import github from './github'
import linkedin from './linkedin'
import back from './back'

export const OBJECTS = [github, linkedin, back]
```

`Spike.jsx` `Scene` (inside `<Physics>`, next to `<Letters>`):

```jsx
import SceneObjects from './objects/SceneObjects'
import { OBJECTS } from './objects'

// navigate is threaded from Spike — useNavigate() throws inside <Canvas> (gotcha #1)
<SceneObjects items={OBJECTS} navigate={navigate} />
```

---

## 6. Implementation

All in the tree: `spike/SceneObject.jsx` (primitive), `spike/objects/SceneObjects.jsx`
(SVG→mesh mapper), `spike/drag.js` `grabOrClick`, `config.BODY` / `config.DEPTH`,
`asciiShader.js` `SIDE_MUL`. Letters build on `SceneObject`. Live objects:
`github`, `linkedin`, `back`, `next`.

### `spike/objects/SceneObjects.jsx` — what it does

Read the file for the source. Contract:

- `useLoader(SVGLoader, d.src)` (suspends — the scene is already under `<Suspense>`).
- `build()` per `src|depth|shading` (module cache): for each `<path>` (skipping
  `fill: none`), `SVGLoader.createShapes` → `ExtrudeGeometry({ depth, bevelEnabled:
  false })`, centred on z=0, later paths nudged `+layer * depth * 0.05` forward.
  Material: `SURFACE_TWO_TONE` or `surfaceColor(hex)`. Also returns the
  normalise transform (`norm = 1 / bboxHeight`, `center`) and logs the bbox in dev.
- Renders `<SceneObject collider={d.collider} position spin ccd grabbable onClick>`
  wrapping `<group scale={[s,s,1]}><group scale={[norm,-norm,1]} position=…>` —
  outer applies `scale`, inner normalises + flips svg's y-down. Depth is never
  in a scaled group.
- `onClick` from `d.to`: number → `navigate(n)`, `^https?:` → `window.open(…,
  '_blank', 'noopener')`, else `navigate(path)`.

---

## 7. Gotchas

1. **R3F is a separate reconciler.** React context does not cross `<Canvas>`.
   `useNavigate()` / any `useContext` **throws** inside the scene. Resolve
   router/nav in `Spike` (which is inside `<BrowserRouter>`) and thread
   `navigate` down as a prop. External `window.open` links need nothing.
2. **SVG is y-down.** Handled by the negative-y scale on the normalise group.
   If a logo renders upside down, its paths were pre-flipped in the file —
   remove the flip there.
3. **Fills must be baked.** No `currentColor`, no CSS classes, no gradients.
4. **Depth centring.** `ExtrudeGeometry` runs `0 → depth`; `build()` translates
   `-depth/2` so the object straddles z=0 like the letters. Skip that and it
   sits half in front of the plane and the two-tone sun goes wrong.
5. **Depth never scales.** `descriptor.scale` is `[s, s, 1]`. Overriding depth
   is `descriptor.depth` only.
6. **Shared GPU resources.** Geometry is cached by `src|depth|shading`;
   `surfaceColor(hex)` is cached by hex; `SURFACE_TWO_TONE` is a singleton.
   Every mesh is `dispose={null}` — safe under StrictMode double-mount and
   fast-refresh. Do not `.dispose()` these.
7. **Collider units are post-normalise.** ~1 unit tall before `scale`.
8. **Spawn above the frame.** `spawn.y` ≳ 7 (frame half-height at the default
   camera is ~5.4) so the object drops in instead of popping into view.

---

## 8. Later — HTML tied to objects

Not built yet; the descriptor leaves room (`html?: () => ReactNode`).

- Each object can carry a DOM slot via drei `<Html transform occlude>` as a
  child of the RigidBody group, so the DOM tracks the body:

  ```jsx
  <Html transform occlude position={[0, -1.2, 0]} zIndexRange={[10, 0]}>
    <div style={{ pointerEvents: 'auto' }}>…</div>
  </Html>
  ```

- **Pages as sections.** A section descriptor renders its route component into
  an `<Html>` panel sized to a `cuboid` collider. The panel is itself a scene
  object under the same contract — it can be dragged and dropped into the
  frame. The object library and the page router converge here.
- Keep `pointerEvents: none` on any panel region that must stay grabbable in
  3D; use `occlude` + `zIndexRange` to layer DOM against the canvas.
