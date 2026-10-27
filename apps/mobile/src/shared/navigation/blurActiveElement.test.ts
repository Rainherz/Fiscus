import { blurActiveElement } from './blurActiveElement';

describe('blurActiveElement', () => {
  it('blurs the focused element on web, so the screen it leaves can be hidden from assistive tech', () => {
    const blur = jest.fn();
    blurActiveElement('web', { activeElement: { blur } });
    expect(blur).toHaveBeenCalledTimes(1);
  });

  it('does nothing on native platforms or without a focused element', () => {
    const blur = jest.fn();
    blurActiveElement('android', { activeElement: { blur } });
    blurActiveElement('ios', { activeElement: { blur } });
    expect(blur).not.toHaveBeenCalled();
    expect(() => blurActiveElement('web', { activeElement: null })).not.toThrow();
    expect(() => blurActiveElement('web', undefined)).not.toThrow();
  });
});
