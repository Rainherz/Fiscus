import { nextPageParam } from './pagination';

describe('nextPageParam', () => {
  it('asks for the next page while pages come back full', () => {
    expect(nextPageParam(new Array(30), [new Array(30)], 30)).toBe(1);
    expect(nextPageParam(new Array(30), [new Array(30), new Array(30)], 30)).toBe(2);
  });

  it('stops when a page is short', () => {
    expect(nextPageParam(new Array(12), [new Array(30), new Array(12)], 30)).toBeUndefined();
    expect(nextPageParam([], [[]], 30)).toBeUndefined();
  });
});
