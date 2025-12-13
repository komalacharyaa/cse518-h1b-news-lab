H1B News Lab — High-fidelity Prototype (Static Web App)
========================================================

This build includes your requested changes:

- 6 news cards minimum.
- Affect slider pops **mid-session** (after half of the cards are displayed).
- Cadence: rapid=1500ms, batched=2500ms, auto=random speeds (1200–3200ms) so it isn’t constant.
- When Source=auto, each article draws from a mix of badges (official/major/social).
- When Uncertainty=auto, some articles are labeled “Developing · may change” and some are not (randomized).
- Autoplay is enabled; **Show digest** reveals all remaining cards immediately.

How to run
----------
1) Unzip this folder.
2) Double-click `index.html` to open in your browser.
3) Start a session and watch the cards appear according to the cadence.
4) After halfway, the affect slider appears. Submit to enable **Finish & Survey**.
5) Export your log as CSV for analysis.
