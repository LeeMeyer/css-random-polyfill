# css-random-polyfill

Minimal polyfill utility for the emergent CSS `random()` function

*STILL EXPERIMENTAL*

## Install

```bash
npm install css-random-polyfill
```

## Usage

### Plain browser script

```html
<script src="https://unpkg.com/css-random-polyfill@latest/dist/css-random-polyfill.js"></script>
```

This runs the polyfill automatically when the page loads.

For development debugging, set `window.__CSS_RANDOM_DEBUG__ = true;` before the script loads. This keeps the patch logs in dev mode and leaves production output quiet.

For a quick local verification page, open `smoke-test.html` in a browser.

### ES module

```js
import "css-random-polyfill";
```

Behavior:

- Processes elements matching `.randomized`
- Resolves calls to random() in custom properties starting with `--random`

## Example CSS

```css
.randomized {
  --random-width: random(100px, 300px);
  width: var(--random-width);
}
```

## Learn the syntax 

https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/random
https://webkit.org/blog/17285/rolling-the-dice-with-css-random/

## Demos

https://codepen.io/collection/yypRBQ