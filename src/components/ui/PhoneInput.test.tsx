import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// Ignore CSS imports in Node test environment
if (typeof require !== 'undefined' && require.extensions) {
  require.extensions['.css'] = () => {};
}

import { PhoneInput } from './PhoneInput';

// Required for React Testing Library with jsdom
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost'
});
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

afterEach(() => {
  cleanup();
});

describe('PhoneInput UI Component', () => {
  test('typing consecutive digits does not lose focus (no remount)', () => {
    render(<PhoneInput name="test-phone" />);
    
    // Find the actual input field
    const input = document.querySelector('input.phone-input-field') as HTMLInputElement;
    assert.ok(input, 'Input field should be rendered');
    
    // Focus the input
    input.focus();
    assert.strictEqual(document.activeElement, input, 'Input should be focused after click');
    
    // Type multiple digits via fireEvent
    fireEvent.change(input, { target: { value: '7712' } });
    fireEvent.change(input, { target: { value: '77123' } });
    
    // If it unmounted/remounted, document.activeElement would be body, or a different input element
    assert.strictEqual(document.activeElement, input, 'Input should retain focus after typing multiple digits');
  });
});
