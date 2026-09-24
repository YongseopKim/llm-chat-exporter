export interface ExportResponse {
  success: boolean;
  data?: string;
  error?: string;
  /** Messages in the export, excluding metadata and artifact lines */
  messageCount?: number;
  /** Signs that the export may not match the page */
  warnings?: string[];
}

interface ContentScriptLoaderDependencies {
  sendMessage(tabId: number, message: { type: string }): Promise<unknown>;
  inject(tabId: number): Promise<void>;
}

export function pingMessageType(buildId: string): string {
  return `PING_EXPORTER:${buildId}`;
}

export function exportMessageType(buildId: string): string {
  return `EXPORT_CONVERSATION:${buildId}`;
}

/** Inject the bundle unless this exact build is already running in the tab. */
export async function executeVersionedContentScript(
  tabId: number,
  buildId: string,
  dependencies: ContentScriptLoaderDependencies
): Promise<ExportResponse> {
  try {
    await dependencies.sendMessage(tabId, { type: pingMessageType(buildId) });
  } catch {
    await dependencies.inject(tabId);
  }

  return (await dependencies.sendMessage(tabId, {
    type: exportMessageType(buildId),
  })) as ExportResponse;
}
