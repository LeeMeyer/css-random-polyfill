import test from 'node:test';
import assert from 'node:assert/strict';

import { installCSSRandomPolyfill } from '../src/polyfill.js';

test('installCSSRandomPolyfill applies a random replacement using a supplied calc function', () => {
  const calls = [];
  const element = {
    style: { setProperty: (name, value) => calls.push([name, value]) },
    matches: () => true,
  };
  const styles = {
    0: '--random-width',
    length: 1,
    getPropertyValue: () => 'random(100px, 300px)',
    [Symbol.iterator]: function* () {
      yield '--random-width';
    },
  };

  const styleTag = {
    textContent: '',
    parentNode: { removeChild: () => {} },
  };

  const document = {
    head: { appendChild: () => {}, removeChild: () => {} },
    createElement: () => styleTag,
    querySelectorAll: () => [element],
    styleSheets: [
      {
        cssRules: [
          {
            selectorText: '.randomized',
            style: {
              [Symbol.iterator]: function* () {
                yield '--random-width';
              },
            },
          },
        ],
      },
    ],
  };

  global.getComputedStyle = () => styles;

  const CSS = { supports: () => false };
  const crypto = { randomUUID: () => 'abc' };

  installCSSRandomPolyfill({
    document,
    CSS,
    crypto,
    calc: (css) => {
      calls.push(['calc-input', css]);
      return '123px';
    },
    window: { document },
  });

  assert.equal(calls[0][0], 'calc-input');
  assert.match(calls[0][1], /^random\(fixed [0-9.]+, 100px, 300px\)$/);
  assert.ok(calls.some(([name]) => name === 'calc-input'));
});

test('installCSSRandomPolyfill preserves element-shared random syntax', () => {
  const calls = [];
  const element = {
    style: { setProperty: (name, value) => calls.push([name, value]) },
    matches: () => true,
  };
  const styles = {
    getPropertyValue: () => 'random(element-shared, -45deg, 45deg)',
  };

  const styleTag = {
    textContent: '',
    parentNode: { removeChild: () => {} },
  };

  const document = {
    head: { appendChild: () => {}, removeChild: () => {} },
    createElement: () => styleTag,
    querySelectorAll: () => [element],
    styleSheets: [
      {
        cssRules: [
          {
            selectorText: '.randomized',
            style: {
              [Symbol.iterator]: function* () {
                yield '--random-angle';
              },
            },
          },
        ],
      },
    ],
  };

  global.getComputedStyle = () => styles;

  const CSS = { supports: () => false };
  const crypto = { randomUUID: () => 'abc' };

  installCSSRandomPolyfill({
    document,
    CSS,
    crypto,
    calc: (css) => {
      calls.push(['calc-input', css]);
      return '12deg';
    },
    window: { document },
  });

  assert.deepEqual(calls[0], ['calc-input', 'random(element-shared, -45deg, 45deg)']);
  assert.deepEqual(calls[1], ['--random-angle', '12deg']);
});

test('installCSSRandomPolyfill keeps the same identity stable within an element and different across elements', () => {
  const calls = [];
  const assignedValues = new Map();
  const valuesByElementID = new Map();
  const availableValues = ['55px', '85px', '105px'];

  const createElement = (name) => ({
    name,
    style: {
      setProperty: (propertyName, value) => {
        calls.push([name, propertyName, value]);
        assignedValues.set(`${name}:${propertyName}`, value);
      },
    },
    matches: () => true,
  });

  const stylesByProperty = {
    '--random-width': 'random(--m, 40px, 100px)',
    '--random-height': 'random(--m, 40px, 100px)',
  };

  const stylesFor = () => ({
    getPropertyValue: (propertyName) => stylesByProperty[propertyName] ?? '',
    [Symbol.iterator]: function* () {
      yield '--random-width';
      yield '--random-height';
    },
  });

  const styleTag = {
    textContent: '',
    parentNode: { removeChild: () => {} },
  };

  const document = {
    head: { appendChild: () => {}, removeChild: () => {} },
    createElement: () => styleTag,
    querySelectorAll: () => [createElement('box-a'), createElement('box-b')],
    styleSheets: [
      {
        cssRules: [
          {
            selectorText: '.randomized',
            style: {
              [Symbol.iterator]: function* () {
                yield '--random-width';
                yield '--random-height';
              },
            },
          },
        ],
      },
    ],
  };

  global.getComputedStyle = () => stylesFor();

  const CSS = { supports: () => false };
  const crypto = { randomUUID: (() => {
    let next = 1;
    return () => `uuid-${next++}`;
  })() };

  installCSSRandomPolyfill({
    document,
    CSS,
    crypto,
    calc: (css, options) => {
      calls.push(['calc-input', css, options.randomCaching.elementID, options.randomCaching.propertyName]);
      const elementKey = options.randomCaching.elementID;
      if (!valuesByElementID.has(elementKey)) {
        valuesByElementID.set(elementKey, availableValues[valuesByElementID.size]);
      }

      return valuesByElementID.get(elementKey);
    },
    window: { document },
  });

  const calcInputs = calls.filter(([name]) => name === 'calc-input');
  assert.equal(calcInputs.length, 4);

  const inputsByElement = new Map();
  for (const [, css, elementID, propertyName] of calcInputs) {
    if (!inputsByElement.has(elementID)) {
      inputsByElement.set(elementID, []);
    }

    inputsByElement.get(elementID).push([css, propertyName]);
  }

  assert.deepEqual([...inputsByElement.keys()].sort(), ['element-uuid-2', 'element-uuid-3']);
  assert.equal(inputsByElement.get('element-uuid-2').length, 2);
  assert.equal(inputsByElement.get('element-uuid-3').length, 2);
  assert.deepEqual(inputsByElement.get('element-uuid-2').map(([css]) => css), ['random(--m, 40px, 100px)', 'random(--m, 40px, 100px)']);
  assert.deepEqual(inputsByElement.get('element-uuid-3').map(([css]) => css), ['random(--m, 40px, 100px)', 'random(--m, 40px, 100px)']);

  assert.equal(assignedValues.get('box-a:--random-width'), assignedValues.get('box-a:--random-height'));
  assert.equal(assignedValues.get('box-b:--random-width'), assignedValues.get('box-b:--random-height'));
  assert.notEqual(assignedValues.get('box-a:--random-width'), assignedValues.get('box-b:--random-width'));
});
