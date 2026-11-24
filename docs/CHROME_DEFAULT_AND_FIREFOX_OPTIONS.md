> **Historical experiment (v0.2.4.9).** For the current public-release candidate, see [v0.2.4.16 release notes](RELEASE_NOTES_v0.2.4.16.md). Chrome automatic remains available, Firefox is manual-only.

# ThreadToMD v0.2.4.9 — browser-specific capture choices

## Chrome

The popup now exposes two options: **Automatic (Chrome)**, the default native wheel capture using the browser debugger, and **Assisted (manual)**. The former *Classic automatic (legacy)* selection is no longer available in the popup; old saved `legacy`/`automatic` choices migrate to Chrome native automatic. Explicit saved `assisted` remains manual.

Automatic input remains 160 px every 110 ms during ordinary navigation. Recovery is used only after a non-edge stall or repeated return-to-newest rebases without newly captured content: new timeline-gutter hit testing avoids nested code/document scrollbars, then up to four bounded rounds use 320–600 px forward and 240–480 px reverse wheels with incremental capture between events. Input remains scoped to the active ChatGPT tab and the Chrome debugger worker permits at most 600 px per event.

Chrome's `debugger` permission is sensitive, required by this experimental local build, and must be evaluated before store publication. The debugger is detached when the scan finishes or switches to manual. Do not open DevTools for the same tab while native capture is running.

## Firefox

**Manual capture is the only available method.** The capture-method picker is hidden because there is no alternative; `Start assisted capture` begins collecting messages, then the user scrolls to the oldest and newest messages and finishes via the progress panel. Both Markdown and ZIP are supported. The native transport and `debugger` permission are excluded from the Firefox package. Old saved method values (including `native`, `legacy` and `automatic`) cannot enable an automatic mode.

Firefox WebExtensions do not implement the Chrome debugger API. WebDriver BiDi supports wheel actions via a remote automation session but does not expose those commands to an ordinary extension. An optional local helper was discussed but is **not part of this version**; do not promise automatic Firefox export.

## Release and integrity

This is a local experimental candidate based on the released v0.2.4. The real ChatGPT UI has no authoritative message total, so complete-history claims remain heuristic. If Chrome's automatic recovery cannot continue, the exporter keeps the captured messages and offers manual completion with an explicit PARTIAL / UNVERIFIED warning.

The customized `README.md` remains unchanged; it still links to the genuinely published v0.2.4 release, rather than inventing links to this unpublished candidate.
