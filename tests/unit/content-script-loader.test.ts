import { describe, expect, it, vi } from 'vitest';
import { executeVersionedContentScript } from '../../src/content-script-loader';

describe('executeVersionedContentScript', () => {
  it('injects the current bundle when a stale content script ignores its build-specific ping', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValueOnce({ success: true, data: 'current export' });
    const inject = vi.fn().mockResolvedValue(undefined);

    await expect(
      executeVersionedContentScript(17, 'build-current', { sendMessage, inject })
    ).resolves.toEqual({ success: true, data: 'current export' });

    expect(sendMessage).toHaveBeenNthCalledWith(1, 17, {
      type: 'PING_EXPORTER:build-current',
    });
    expect(inject).toHaveBeenCalledWith(17);
    expect(sendMessage).toHaveBeenNthCalledWith(2, 17, {
      type: 'EXPORT_CONVERSATION:build-current',
    });
  });

  it('reuses a content script only when the current build answers', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true, data: 'current export' });
    const inject = vi.fn().mockResolvedValue(undefined);

    await executeVersionedContentScript(17, 'build-current', { sendMessage, inject });

    expect(inject).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenLastCalledWith(17, {
      type: 'EXPORT_CONVERSATION:build-current',
    });
  });
});
