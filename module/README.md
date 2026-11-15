# syly-db-assistant

`<db-assistant>`: an accessible, multilingual (Amharic, English, Arabic) course assistant as one web component. It answers a learner's question from your course text, links every answer to its source section, reads it aloud, and always offers a real person. No dependencies, no build step.

Part of SYLY, Track 3 of the Digital Bridge Accessibility Hackathon (ALX). Source, docs and the server: https://github.com/yamneg96/SYLY

## Use

```bash
npm i syly-db-assistant
```

In a bundler (import on the client only; the component needs a browser):

```js
import 'syly-db-assistant/db-assistant.js';
```

Or with a script tag that points into `node_modules`:

```html
<script src="/node_modules/syly-db-assistant/db-assistant.js" defer></script>
<db-assistant lang="en" content="/lesson/content.json"></db-assistant>
```

From a CDN, pinned to a version:

```html
<script src="https://cdn.jsdelivr.net/gh/yamneg96/SYLY@v1.0.0/module/db-assistant.js" defer></script>
```

When you load the file from a CDN or from `node_modules`, give `api` and `content` as full `https://` addresses: there is no "own server" to guess.

## Attributes

`lang` (`am`, `en`, `ar`), `api` (server base URL), `content` (content file URL), `site` (site key from the SYLY dashboard), `theme` (`auto`, `light`, `dark`), `mode` (`panel`, `inline`), `position` (`end`, `start`), `primary` (one colour, needs 4.5:1 with white), `content-selector`, `read-page` (`always`, `off`). Full reference: https://github.com/yamneg96/SYLY#install-level-1

The dictionaries (`i18n/`) are loaded next to the script and are also inlined, so the component works from any URL. Pre-generated Amharic audio is in `audio/` (Amharic text is a draft: needs a native reader check).

## Licence

To be confirmed (TBD); see `LICENSE`. Test data only.
