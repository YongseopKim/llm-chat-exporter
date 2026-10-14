/** Image CDNs observed on the supported chat pages. */
export function isRemoteImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['https://images.openai.com', 'https://assets.grok.com'].includes(url.origin) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Grok generated images require its CDN session; public ChatGPT images do not. */
export async function readRemoteImage(url: string): Promise<string> {
  if (!isRemoteImageUrl(url)) throw new Error('Unsupported external image origin');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      credentials: new URL(url).origin === 'https://assets.grok.com' ? 'include' : 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!mime || !/^image\/(?:png|jpeg|gif|webp|avif|svg\+xml|x-icon|vnd.microsoft.icon)$/.test(mime)) {
      await response.body?.cancel();
      throw new Error('Response is not a supported image');
    }
    if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
      await response.body?.cancel();
      throw new Error('Image exceeds the 5 MiB limit');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Image response is empty');
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error('Image exceeds the 5 MiB limit');
      }
      chunks.push(value);
    }
    if (!size) throw new Error('Image response is empty');
    // Bound string conversions to avoid exceeding the JS argument stack.
    let binary = '';
    for (const chunk of chunks) {
      for (let start = 0; start < chunk.length; start += 8192) {
        binary += String.fromCharCode(...chunk.subarray(start, start + 8192));
      }
    }
    return `data:${mime};base64,${btoa(binary)}`;
  } finally {
    clearTimeout(timer);
  }
}

/** Only a provider's own top-level page may use its image CDN permission. */
export async function handleImageRequest(url: unknown, sender: chrome.runtime.MessageSender): Promise<string> {
  if (typeof url !== 'string' || !sender.tab?.id || sender.frameId !== 0
      || !sender.url || !sender.tab.url
      || new URL(sender.url).origin !== new URL(sender.tab.url).origin
      || !isRemoteImageUrl(url)
      || ({ 'https://chatgpt.com': 'https://images.openai.com', 'https://grok.com': 'https://assets.grok.com' } as Record<string, string>)[new URL(sender.url).origin] !== new URL(url).origin) {
    throw new Error('Images must be requested by the matching ChatGPT or Grok conversation');
  }
  return readRemoteImage(url);
}
