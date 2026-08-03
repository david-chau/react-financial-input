# Third-party notices

`react-financial-input` itself is MIT licensed, has no runtime dependencies, and
its JavaScript bundles nothing from anyone else. This file covers the one asset
it redistributes.

## flags.woff2 — "Twemoji Country Flags"

Shipped so that country flags render everywhere, including Windows, which has
no flag glyphs of its own.

It is a separate subpath export (`react-financial-input/flags.css`), never
referenced by the built JavaScript, so a consumer who shows no flags never
receives it. A consumer who does show flags and wants them on every OS is
expected to import it — that is not an optional extra, it is what OS parity
costs.

**Artwork** — Twemoji, © Twitter, Inc and other contributors, used and
redistributed under the Creative Commons Attribution 4.0 International licence.

- https://github.com/twitter/twemoji
- https://creativecommons.org/licenses/by/4.0/

**The subset** — "Twemoji Country Flags" is a subset of Twemoji Mozilla, cut
down to the flag codepoints with `pyftsubset`, by TalkJS as part of
[`country-flag-emoji-polyfill`](https://github.com/talkjs/country-flag-emoji-polyfill)
(MIT).

```
Copyright (c) 2022 TalkJS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### If Twemoji adds flags

The subset needs regenerating when Twemoji Mozilla gains new country flags,
which happens when a country changes its flag or a new one is recognised —
rarely, and never urgently. Regenerate from the upstream project and replace
`flags.woff2`.
