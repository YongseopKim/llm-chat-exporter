export interface RichSources {
  groups: { title: string; url: string }[][];
  warnings: string[];
}

/** Serialized into MAIN by chrome.scripting; keep runtime dependencies local.
 * Read only this conversation's source component results. Never execute the
 * generated component code or return session credentials / raw API responses.
 */
export async function readRichSourcesBatch(ids: string[]): Promise<Record<string, RichSources>> {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-dil-message-id]'));
  if (!ids.length || ids.some(id => !roots.some(node => node.getAttribute('data-dil-message-id') === id))) {
    throw new Error('ChatGPT: rich answer or conversation ID is unavailable.');
  }
  const conversationId = document.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/)?.[1];
  if (!conversationId) throw new Error('ChatGPT: rich answer or conversation ID is unavailable.');
  const getJson = async (path: string, token?: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { credentials: 'include', signal: controller.signal,
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      if (!response.ok) throw new Error(`ChatGPT: source request HTTP ${response.status}.`);
      return await response.json();
    } finally { clearTimeout(timer); }
  };
  const started = performance.now();
  const session = await getJson('/api/auth/session');
  if (typeof session.accessToken !== 'string') throw new Error('ChatGPT: source session unavailable.');
  const conversation = await getJson(`/backend-api/conversation/${conversationId}`, session.accessToken);
  const fetchedMs = Math.round(performance.now() - started);
  const previousFocus = document.activeElement as HTMLElement | null;
  const answers: Record<string, RichSources> = Object.create(null);
  for (const id of [...new Set(ids)]) {
    const root = roots.find(node => node.getAttribute('data-dil-message-id') === id)!;
    const components = conversation.mapping?.[id]?.message?.metadata?.model_dil_v2?.appData?.opGenui?.componentResults;
    if (!components || typeof components !== 'object') {
      answers[id] = { groups: [], warnings: ['ChatGPT: source component results unavailable.'] };
      continue;
    }
    const candidates: RichSources['groups'] = [];
    for (const component of Object.values(components) as { state?: { items?: unknown[] } }[]) {
      const items = component?.state?.items;
      if (!Array.isArray(items) || !items.length) continue;
      const sources = items.flatMap(item => {
        const source = item as { title?: unknown; url?: unknown };
        return typeof source?.title === 'string' && typeof source.url === 'string' && /^https?:\/\//i.test(source.url)
          ? [{ title: source.title, url: source.url }] : [];
      });
      if (sources.length === items.length) candidates.push(sources);
    }
    const groups: RichSources['groups'] = [];
    const warnings: string[] = [];
    const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
    for (const [index, trigger] of Array.from(root.querySelectorAll<HTMLElement>('[data-d-component="popover-trigger"]')).entries()) {
      groups.push([]);
      const link = trigger.matches('a[href]') ? trigger as HTMLAnchorElement : trigger.querySelector<HTMLAnchorElement>('a[href]');
      if (link && /^https?:/.test(link.href)) {
        groups[index] = [{ title: link.textContent?.trim() || link.href, url: link.href }];
        continue;
      }
      const wasOpen = trigger.getAttribute('aria-expanded') === 'true';
      try {
        if (!wasOpen) trigger.click();
        let popup: HTMLElement | null = null;
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
          const controls = trigger.getAttribute('aria-controls');
          popup = controls ? document.getElementById(controls) : null;
          if (popup?.querySelector('[data-d-component="pressable"]')) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        const cards = Array.from(popup?.querySelectorAll<HTMLElement>('[data-d-component="pressable"]') || []);
        const titles = cards.map(card => normalize(card.querySelector('[data-d-weight="medium"]')?.textContent || ''));
        if (!titles.length || titles.some(title => !title)) throw new Error('Source popup titles unavailable.');
        const matches = candidates.filter(group => group.length === titles.length
          && group.every((source, cardIndex) => normalize(source.title) === titles[cardIndex]));
        const distinct = new Map(matches.map(group => [JSON.stringify(group.map(source => source.url)), group]));
        if (distinct.size !== 1) throw new Error('Popup titles do not identify a unique source URL group.');
        groups[index] = distinct.values().next().value!;
      } catch (error) {
        warnings.push(`ChatGPT: Rich source group ${index + 1}: ${(error as Error).message}`);
      } finally {
        if (!wasOpen && trigger.getAttribute('aria-expanded') === 'true') trigger.click();
      }
    }
    answers[id] = { groups, warnings };
  }
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  console.log(`LLM Chat Exporter: Rich sources (answers=${ids.length}, groups=${Object.values(answers).reduce((total, answer) => total + answer.groups.length, 0)}, fetch=${fetchedMs}ms, popups=${Math.round(performance.now() - started - fetchedMs)}ms)`);
  return answers;
}

export async function readRichSources(id: string): Promise<RichSources> {
  return (await readRichSourcesBatch([id]))[id];
}

export async function collectRichSources(tabId: number, id: string, ids: string[] = [id]): Promise<RichSources & { answers?: Record<string, RichSources> }> {
  const results = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: readRichSourcesBatch, args: [ids],
  });
  const answers = results[0]?.result;
  if (!answers?.[id]) throw new Error('ChatGPT: rich source collection returned no result.');
  return { ...answers[id], ...(ids.length > 1 ? { answers } : {}) };
}
