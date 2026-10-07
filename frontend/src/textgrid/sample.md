# Text grid spike

Every glyph on this page is **one texel** in a data texture. The shader looks up the cell, picks a glyph from a font atlas and draws it. Scrolling is a single uniform. Try the wheel, arrows, `PgDn`, drag to highlight, press ctrl+F to find, or `/` and `?` for nvim-style patterns (`\c`, `.`, `\+`, `\<word\>`), then `n` and `N`.

## Why

The devlog used to be a DOM overlay because long-form text did not suit the glyph pass. This flips it: the text **is** the glyph pass, so it can share the look, the palette and, eventually, the scene.

> Rich documents that read and scroll well, in the same visual language as the rest of the site.

### What renders

- **Headings** with underline rules, in bold atlas glyphs
- Paragraphs with word wrap, `inline code`, and [links](https://github.com/graemeibb) that highlight on hover
- Lists with hanging indents, so wrapped lines stay aligned under the first word of the item
- Block quotes, code blocks, rules and scene windows

## Code

```
const cell = doc.link[row * cols + col]
if (cell) open(doc.links[cell - 1])
```

## Scene windows

A block can hand its cells to another glyph source. This one is a plasma using the scene's luminance ramp. The real version would let the 3D scene show through.

:::window 9

## Long form

Scrolling should feel good over a long document, so here is a wall of text. The layout runs on the CPU whenever the column count changes and the result is packed into a texture one byte per channel: glyph, style, flags and link id. Nothing is re-uploaded while you scroll.

The atlas is rasterised at the device pixel ratio and sampled one to one with nearest filtering, which is why the text stays crisp even at small sizes. The scene's own cell is six pixels square, far too small for prose, so the text grid has its own cell size and its own atlas.

---

### Limits

- Monospace only, so wrapping is exact but there is no proportional typography
- Link ids are one byte, so at most 255 links per document
- Only printable ascii for now, anything else becomes a question mark
- Selection and search live in the grid; the hidden DOM mirror is for screen readers only

### Next

- Big headings built from scene-cell letters
- Dithered images through the luminance ramp
- Tables
- Folding the layer into the main ascii pass so scene objects can sit behind text

## End

That is all. Scroll back up with `Home`.
