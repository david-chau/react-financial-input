# Changelog

## [0.6.6](https://github.com/david-chau/react-financial-input/compare/v0.6.5...v0.6.6) (2026-08-03)


### Bug fixes

* chain pasted shortcuts, and stop currency symbols reading as multipliers ([#30](https://github.com/david-chau/react-financial-input/issues/30)) ([73048cf](https://github.com/david-chau/react-financial-input/commit/73048cf55e5cf8ed0c0b51244f8ac6624606566e))

## [0.6.5](https://github.com/david-chau/react-financial-input/compare/v0.6.4...v0.6.5) (2026-08-03)


### Bug fixes

* accept a paste that arrives as insertText ([#28](https://github.com/david-chau/react-financial-input/issues/28)) ([62fce1f](https://github.com/david-chau/react-financial-input/commit/62fce1fbbf071a17aa57635cc2a32fc600a4b4c3))

## [0.6.4](https://github.com/david-chau/react-financial-input/compare/v0.6.3...v0.6.4) (2026-08-03)


### Bug fixes

* stop the value running under a suffix currency symbol ([#26](https://github.com/david-chau/react-financial-input/issues/26)) ([6e9808d](https://github.com/david-chau/react-financial-input/commit/6e9808d861bf7426a5f8c86cdf307d7f6ece0c3f))

## [0.6.3](https://github.com/david-chau/react-financial-input/compare/v0.6.2...v0.6.3) (2026-08-03)


### Bug fixes

* drop the blank line that broke prettier on main ([79abde4](https://github.com/david-chau/react-financial-input/commit/79abde4b3c4554e1eb3e67457495fe0978a7f966))


### Documentation

* trim the quick start, and record what 0.6.2 actually shipped ([#23](https://github.com/david-chau/react-financial-input/issues/23)) ([448ac5d](https://github.com/david-chau/react-financial-input/commit/448ac5d8ed88daeca7d26819fda573245165ae63))
* update playground link in README to include file context ([4ad886a](https://github.com/david-chau/react-financial-input/commit/4ad886acef09444ea3f63ea6bb61bbd0cc594528))

## [0.6.2](https://github.com/david-chau/react-financial-input/compare/v0.6.1...v0.6.2) (2026-08-03)

> **This release contains features, despite the patch version.** The release
> pull request was generated when only the documentation commit below was
> pending, then [#22](https://github.com/david-chau/react-financial-input/pull/22)
> merged, and the release pull request was merged without being regenerated —
> so the `v0.6.2` tag sits on top of a `feat:` commit that never got its own
> version bump or entry. Everything in #22 is in 0.6.2 and is listed here by
> hand. Nothing is missing from the package; only the version understates it.

### Features

* string-valued API — `valueType="string"` accepts canonical, display or `2.5m`
  and hands back canonical text; `canonicalValue` added to the hook
  ([#22](https://github.com/david-chau/react-financial-input/pull/22))
* currency search replaces the `<select>` picker, with the preset, a custom
  array and the locale exposed as Storybook controls
  ([#22](https://github.com/david-chau/react-financial-input/pull/22))
* `peerDependencies` widened to `react >=18.0.0` / `react-dom >=18.0.0`
  ([#22](https://github.com/david-chau/react-financial-input/pull/22))

### Bug fixes

* `useRef<T>(undefined)` typed so it compiles against `@types/react@18.0`,
  which has no such overload — the declared floor was broken
  ([#22](https://github.com/david-chau/react-financial-input/pull/22))

### Documentation

* record the approve-then-merge order for release PRs ([#20](https://github.com/david-chau/react-financial-input/issues/20)) ([4e4b059](https://github.com/david-chau/react-financial-input/commit/4e4b05962722d77887cc9f7498445186b3153e07))
* correct the form-submission examples, which put `name` on the input and so
  submitted the formatted value ([#22](https://github.com/david-chau/react-financial-input/pull/22))

### Removed

* the `<select>` currency picker and its `.rfi-select` styles. Search replaces
  it ([#22](https://github.com/david-chau/react-financial-input/pull/22))

## [0.6.1](https://github.com/david-chau/react-financial-input/compare/v0.6.0...v0.6.1) (2026-08-03)


### Bug fixes

* recover the panel centring and the select chevron ([#18](https://github.com/david-chau/react-financial-input/issues/18)) ([9a4d4ae](https://github.com/david-chau/react-financial-input/commit/9a4d4aea7678c20c87149d6f1fe73629cf62a839))

## [0.6.0](https://github.com/david-chau/react-financial-input/compare/v0.5.1...v0.6.0) (2026-08-03)


### Features

* currency search and presets, parseAmount, and two real-device fixes ([#16](https://github.com/david-chau/react-financial-input/issues/16)) ([82a3c7f](https://github.com/david-chau/react-financial-input/commit/82a3c7f5ad2c82511cbc39428c6ab7a2213c2806))

## [0.5.1](https://github.com/david-chau/react-financial-input/compare/v0.5.0...v0.5.1) (2026-08-02)


### Bug fixes

* mobile debug panel, keypad polish, and a version badge ([#14](https://github.com/david-chau/react-financial-input/issues/14)) ([9888759](https://github.com/david-chau/react-financial-input/commit/98887591c93e7900061f4ca22c00ab832742f218))

## [0.5.0](https://github.com/david-chau/react-financial-input/compare/v0.4.0...v0.5.0) (2026-08-02)


### Features

* clear button, currency picker, calculator keypad ([#12](https://github.com/david-chau/react-financial-input/issues/12)) ([d39f82d](https://github.com/david-chau/react-financial-input/commit/d39f82dd857fd0b0d081c218d820ab61e02b66ce))

## [0.4.0](https://github.com/david-chau/react-financial-input/compare/v0.3.0...v0.4.0) (2026-08-02)


### Features

* implement undo and redo ([#9](https://github.com/david-chau/react-financial-input/issues/9)) ([d604547](https://github.com/david-chau/react-financial-input/commit/d6045476642a1fab62797957cb0c79b57c2f81ae))


### Bug fixes

* reject non-numeric characters, and rework the Storybook ([#11](https://github.com/david-chau/react-financial-input/issues/11)) ([ea1828f](https://github.com/david-chau/react-financial-input/commit/ea1828fbc47c5d5ef6d560977ec6a6f2f7a2afa2))

## [0.3.0](https://github.com/david-chau/react-financial-input/compare/v0.2.1...v0.3.0) (2026-08-02)


### Features

* handle every input path, plus locale, currency, shortcuts and range ([#5](https://github.com/david-chau/react-financial-input/issues/5)) ([738d261](https://github.com/david-chau/react-financial-input/commit/738d26114b7be39eb4bf3f321fa22e202caefaf3))


### Bug fixes

* **ci:** tag releases correctly, and cache Playwright browsers ([#7](https://github.com/david-chau/react-financial-input/issues/7)) ([aafc1aa](https://github.com/david-chau/react-financial-input/commit/aafc1aad43306e2bd071fb30516f3275ab8e4b0b))
* **ci:** unblock the release pipeline ([#6](https://github.com/david-chau/react-financial-input/issues/6)) ([9586690](https://github.com/david-chau/react-financial-input/commit/95866903ff612cf35f119154009938494033aeed))

## [0.2.1](https://github.com/david-chau/react-financial-input/compare/v0.2.0...v0.2.1) (2026-08-01)


### Bug fixes

* dark mode visibility and callback ref stability ([#3](https://github.com/david-chau/react-financial-input/issues/3)) ([62cfa36](https://github.com/david-chau/react-financial-input/commit/62cfa363776b2dc6516ee435cd1065b6225f06a8))
