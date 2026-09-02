import { describe, expect, it } from 'vitest';
import {
  calculateScreenshotCrop,
  requestVisualizationReady,
  waitForStableVisualization,
  type VisualizationFrame,
} from '../../src/content/visualization-capture';

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

describe('waitForStableVisualization', () => {
  const blank: VisualizationFrame = {
    dataUrl: 'data:image/png;base64,blank',
    pixels: new Uint8ClampedArray([
      232, 232, 232, 255,
      232, 232, 232, 255,
      232, 232, 232, 255,
    ]),
  };
  const rendered: VisualizationFrame = {
    dataUrl: 'data:image/png;base64,rendered',
    pixels: new Uint8ClampedArray([
      10, 20, 30, 255,
      200, 120, 40, 255,
      60, 180, 220, 255,
    ]),
  };

  it('ignores a temporary stable pause and requires four rendered frames', async () => {
    const partial: VisualizationFrame = {
      dataUrl: 'data:image/png;base64,partial',
      pixels: new Uint8ClampedArray([
        10, 20, 30, 255,
        190, 110, 30, 255,
        60, 180, 220, 255,
      ]),
    };
    const frames = [blank, partial, partial, rendered, rendered, rendered, rendered];
    const capture = async () => frames.shift() || null;

    await expect(
      waitForStableVisualization(capture, () => true, {
        maxWaitMs: 30000,
        now: () => 0,
      })
    ).resolves.toBe(rendered);
    expect(frames).toHaveLength(0);
  });

  it('returns null when every frame stays blank until the deadline', async () => {
    let now = 0;
    let calls = 0;
    const capture = async () => {
      calls += 1;
      now += 15000;
      return blank;
    };

    await expect(
      waitForStableVisualization(capture, () => true, {
        maxWaitMs: 30000,
        now: () => now,
      })
    ).resolves.toBeNull();
    expect(calls).toBe(2);
  });

  it('stops immediately when the iframe disappears', async () => {
    let calls = 0;
    const capture = async () => {
      calls += 1;
      return rendered;
    };

    await expect(
      waitForStableVisualization(capture, () => false, {
        maxWaitMs: 30000,
        now: () => 0,
      })
    ).resolves.toBeNull();
    expect(calls).toBe(0);
  });
});

describe('requestVisualizationReady', () => {
  it('asks the service worker to verify the exact cross-origin frame', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true, ready: true });

    await expect(
      requestVisualizationReady(
        'https://fixture.claudemcpcontent.com/mcp_apps?visualization=1',
        sendMessage
      )
    ).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'WAIT_FOR_VISUALIZATION_READY',
      frameUrl: 'https://fixture.claudemcpcontent.com/mcp_apps?visualization=1',
    });
  });

  it('does not treat an inaccessible frame as ready', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: false, ready: false });

    await expect(
      requestVisualizationReady('https://fixture.claudemcpcontent.com/mcp_apps', sendMessage)
    ).resolves.toBe(false);
  });

  it('does not ask the service worker to inspect another host', async () => {
    const sendMessage = vi.fn();

    await expect(
      requestVisualizationReady('https://example.com/not-a-claude-frame', sendMessage)
    ).resolves.toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
