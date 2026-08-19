import { calc } from "@csstools/css-calc";

export function installCSSRandomPolyfill(options = {}) {
  const globalScope = options.window ?? globalThis;
  const document = options.document ?? globalScope.document;
  const CSS = options.CSS ?? globalScope.CSS;
  const crypto = options.crypto ?? globalScope.crypto;
  const calcFn = options.calc ?? calc;
  const debugRandomPatches = options.debugRandomPatches ?? globalScope.__CSS_RANDOM_DEBUG__;
  const forcePolyfill = options.forcePolyfill ?? globalScope.__CSS_RANDOM_FORCE_POLYFILL__;

  if (!document || !CSS || !crypto || !calcFn) {
    if (debugRandomPatches) {
      console.log("[css-random-polyfill] skipped: missing runtime dependency", {
        hasDocument: Boolean(document),
        hasCSS: Boolean(CSS),
        hasCrypto: Boolean(crypto),
        hasCalc: Boolean(calcFn),
      });
    }
    return false;
  }

  if (!forcePolyfill && CSS.supports("width", "random(0px, 100px)")) {
    if (debugRandomPatches) {
      console.log("[css-random-polyfill] skipped: native random() support detected", {
        forcePolyfill: Boolean(forcePolyfill),
      });
    }
    return false;
  }

  if (debugRandomPatches) {
    console.log("[css-random-polyfill] install start", {
      forcePolyfill: Boolean(forcePolyfill),
    });
  }

  const styleTag = document.createElement("style");
  styleTag.textContent = ".randomized { display: none; }";
  document.head.appendChild(styleTag);

  const elementIDs = new WeakMap();
  const documentID = crypto.randomUUID();
  const randomizedElements = document.querySelectorAll(".randomized");

  if (debugRandomPatches) {
    console.log("[css-random-polyfill] randomized elements found", {
      count: randomizedElements.length,
      documentID,
    });
  }

  randomizedElements.forEach((element) => {
    const styles = getComputedStyle(element);
    const randomPropertyNames = getRandomPropertyNames(element, document);

    randomPropertyNames.forEach((propertyName) => {
        const css = styles.getPropertyValue(propertyName);
        if (!css || !css.includes("random(")) {
          return;
        }

        const value = resolveRandom(css, {
          element,
          propertyName,
          documentID,
          elementIDs,
          calcFn,
          crypto,
          CSS,
          debugRandomPatches,
        });
        element.style.setProperty(propertyName, value);
      });
  });

  if (styleTag.parentNode) {
    styleTag.parentNode.removeChild(styleTag);
  }

  return true;
}

function getRandomPropertyNames(element, document) {
  const names = new Set();

  if (element.style && typeof element.style[Symbol.iterator] === "function") {
    for (const propertyName of element.style) {
      if (propertyName.startsWith("--random")) {
        names.add(propertyName);
      }
    }
  }

  if (document && document.styleSheets) {
    for (const styleSheet of document.styleSheets) {
      let rules;
      try {
        rules = styleSheet.cssRules;
      } catch {
        continue;
      }

      collectRandomPropertiesFromRules(rules, element, names);
    }
  }

  return [...names];
}

function collectRandomPropertiesFromRules(rules, element, names) {
  if (!rules) {
    return;
  }

  for (const rule of rules) {
    if (rule.selectorText && rule.style && element.matches(rule.selectorText)) {
      for (const propertyName of rule.style) {
        if (propertyName.startsWith("--random")) {
          names.add(propertyName);
        }
      }
    }

    if (rule.cssRules) {
      collectRandomPropertiesFromRules(rule.cssRules, element, names);
    }
  }
}

function getOrSetElementID(elementIDs, element, crypto) {
  let id = elementIDs.get(element);

  if (!id) {
    id = `element-${crypto.randomUUID()}`;
    elementIDs.set(element, id);
  }

  return id;
}

function resolveRandom(css, { element, propertyName, documentID, elementIDs, calcFn, crypto, CSS, debugRandomPatches }) {
  const patchedCss = css.replace(
    /random\(\s*(?!(?:[^,]*\b(?:shared|scoped)\b|fixed\b|--))([^,]+),/gi,
    (_, expression) => `random(fixed ${Math.random()}, ${expression},`
  );

  const elementID = getOrSetElementID(elementIDs, element, crypto);
  const inputForCalc = patchedCss;
  const isRandomColor = propertyName.trim().toLowerCase() === "--random-color";

  if (debugRandomPatches && isRandomColor) {
    console.log("[css-random-polyfill] --random-color input", {
      propertyName,
      documentID,
      elementID,
      originalCss: css,
      inputForCalc,
    });
  }

  const resolvedValue = calcFn(inputForCalc, {
    precision: 5,
    toCanonicalUnits: true,
    randomCaching: {
      documentID,
      elementID,
      propertyName,
    },
  });

  if (debugRandomPatches && isRandomColor) {
    const supportsIfStyle = Boolean(CSS && typeof CSS.supports === "function" && CSS.supports("color", "if(style(--thing: 0): blue; else: red;)"));
    console.log("[css-random-polyfill] --random-color output", {
      propertyName,
      documentID,
      elementID,
      supportsIfStyle,
      resolvedValue,
    });

    if (/\bif\s*\(/i.test(resolvedValue)) {
      console.warn("[css-random-polyfill] --random-color unresolved if/style expression after css-calc", {
        reason: "css-calc resolved random() but left if(style(...)) for the browser",
        likelyResult: "if/style unsupported or invalid in this context will keep fallback color",
        resolvedValue,
      });
    }
  }

  return resolvedValue;
}
