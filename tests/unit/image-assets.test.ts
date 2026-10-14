import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleImageRequest, isRemoteImageUrl, MAX_IMAGE_BYTES, readRemoteImage } from '../../src/image-assets';

const url = 'https://images.openai.com/static-rsc-4/report?purpose=inline';
const sender = { tab: { id: 7, url: 'https://chatgpt.com/c/test' }, url: 'https://chatgpt.com/c/test', frameId: 0 } as chrome.runtime.MessageSender;
afterEach(() => vi.unstubAllGlobals());

describe('external image reader', () => {
  it('embeds authenticated Grok generated image bytes only for the Grok top-level conversation', async () => {
    const image = 'https://assets.grok.com/users/user/generated/image/image.jpg';
    const grok = { tab: { id: 8, url: 'https://grok.com/c/test' }, url: 'https://grok.com/c/test', frameId: 0 } as chrome.runtime.MessageSender;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => options?.credentials === 'include'
      ? new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } })
      : new Response('denied', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await handleImageRequest(image, grok)).toBe('data:image/jpeg;base64,AQID');
    expect(fetchMock).toHaveBeenCalledWith(image, expect.objectContaining({ credentials: 'include', redirect: 'error' }));
    await expect(handleImageRequest(image, sender)).rejects.toThrow();
    await expect(handleImageRequest(url, grok)).rejects.toThrow();
  });

  it('reads actual response bytes without cookies or redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await handleImageRequest(url, sender)).toBe('data:image/png;base64,AQID');
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal) }));
  });

  it.each(['http://images.openai.com/x', 'https://images.openai.com.evil.test/x', 'https://user@images.openai.com/x', 'https://169.254.169.254/x', 'https://images.openai.com:444/x'])('rejects unapproved URLs: %s', async value => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect(isRemoteImageUrl(value)).toBe(false);
    await expect(readRemoteImage(value)).rejects.toThrow('Unsupported');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { ...sender, frameId: 2 },
    { ...sender, url: 'https://evil.test/' },
    { ...sender, tab: { id: 7, url: 'https://evil.test/' } },
    { frameId: 0 },
  ])('rejects requests from other pages and frames', async source => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(handleImageRequest(url, source as chrome.runtime.MessageSender)).rejects.toThrow('ChatGPT');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    new Response('denied', { status: 403 }),
    new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('', { headers: { 'Content-Type': 'image/png' } }),
    new Response('large', { headers: { 'Content-Type': 'image/png', 'Content-Length': String(MAX_IMAGE_BYTES + 1) } }),
    new Response(new Uint8Array(MAX_IMAGE_BYTES + 1), { headers: { 'Content-Type': 'image/png' } }),
  ])('rejects failed, non-image, empty, or oversized responses', async response => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(readRemoteImage(url)).rejects.toThrow();
  });
});
