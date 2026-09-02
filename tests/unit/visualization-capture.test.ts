import { describe, expect, it } from 'vitest';
import { calculateScreenshotCrop } from '../../src/content/visualization-capture';

describe('calculateScreenshotCrop', () => {
  it('converts CSS pixels to captured device pixels', () => {
    expect(
      calculateScreenshotCrop(
        { left: 100, top: 50, width: 300, height: 200 },
        { width: 1000, height: 600 },
        { width: 2000, height: 1200 }
      )
    ).toEqual({
      sourceX: 200,
      sourceY: 100,
      sourceWidth: 600,
      sourceHeight: 400,
    });
  });

  it('supports non-integer browser scaling', () => {
    expect(
      calculateScreenshotCrop(
        { left: 10, top: 20, width: 100, height: 80 },
        { width: 800, height: 600 },
        { width: 1000, height: 750 }
      )
    ).toEqual({
      sourceX: 13,
      sourceY: 25,
      sourceWidth: 125,
      sourceHeight: 100,
    });
  });

  it('rejects a visualization that is only partially visible', () => {
    expect(
      calculateScreenshotCrop(
        { left: 20, top: 500, width: 600, height: 200 },
        { width: 1000, height: 600 },
        { width: 2000, height: 1200 }
      )
    ).toBeNull();
  });
});
