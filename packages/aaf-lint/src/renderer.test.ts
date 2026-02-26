import { describe, it, expect } from 'vitest';
import { renderURL } from './renderer.js';

describe('renderer', () => {
  it('exports renderURL as a function', () => {
    expect(typeof renderURL).toBe('function');
  });
});
