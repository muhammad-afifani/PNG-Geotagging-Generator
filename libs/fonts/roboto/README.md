# Roboto (bundled)

Roboto by The Roboto Project Authors, SIL Open Font License 1.1 (see `LICENSE`),
taken from `@fontsource/roboto` 5.3.0 (Roboto 3.015, latin + latin-ext subsets,
weights 400/500/700).

Used for Template 2 so the stamp is drawn with the same font as the real
GPS Map Camera app (Android's system Roboto) on every device.

**Modified:** in the `latin` files, the digit characters 0–9 are mapped to the
font's own proportional-figure glyphs (its `pnum` feature) instead of the
default tabular ones, because that is how Android renders them and canvas text
cannot switch OpenType features. No glyph outlines were changed. Loaded under
the family name `GeoStamp Roboto` (see `css/style.css`).
