/**
 * Files a Grok answer wrote to its project
 *
 * The answer shows such a file as a card; the file's text is not in the
 * page until the card is opened. Measured on 2026-10-03, opening the card
 * reads it this way, and so does the export:
 *   GET /rest/workspaces/<project>/files?recursive=true      every file's path
 *   GET /rest/workspaces/<project>/files/content?path=<path> { signedUrl, size }
 *   GET <signedUrl>                                          the file itself
 * The signed URL points at Grok's own storage and authorizes itself, so the
 * session's cookies are sent only to grok.com.
 */

import type { ArtifactData } from './interface';

const PROJECT_PATH = /^\/project\/([^/?#]+)/;

interface ProjectFile {
  path?: string;
  name?: string;
  isDirectory?: boolean;
  size?: string;
}

function grokGet(path: string): Promise<Response> {
  return fetch(new URL(path, document.location.origin).href, { credentials: 'include' });
}

/**
 * Read a project file by the name its card shows
 *
 * @throws Error explaining why the file could not be read whole
 */
export async function readGrokFile(name: string): Promise<ArtifactData> {
  const project = document.location.pathname.match(PROJECT_PATH)?.[1];
  if (!project) {
    throw new Error('this conversation is not in a project.');
  }

  const list = await grokGet(`/rest/workspaces/${project}/files?recursive=true`);
  if (!list.ok) {
    throw new Error(`listing the project files failed (HTTP ${list.status}).`);
  }
  const files = ((await list.json()) as { files?: ProjectFile[] }).files ?? [];
  const matches = files.filter((file) => !file.isDirectory && file.name === name && file.path);
  if (matches.length !== 1) {
    throw new Error(
      matches.length ? `${matches.length} project files have this name.` : 'the project has no file with this name.'
    );
  }

  const located = await grokGet(
    `/rest/workspaces/${project}/files/content?path=${encodeURIComponent(matches[0].path!)}`
  );
  if (!located.ok) {
    throw new Error(`locating the file failed (HTTP ${located.status}).`);
  }
  const { signedUrl, size } = (await located.json()) as { signedUrl?: string; size?: string };
  if (!signedUrl) {
    throw new Error('Grok returned no download URL.');
  }

  const download = await fetch(signedUrl);
  if (!download.ok) {
    throw new Error(`downloading the file failed (HTTP ${download.status}).`);
  }
  const content = await download.text();

  // A short read would otherwise export as if it were the whole file
  const received = new TextEncoder().encode(content).length;
  const expected = Number(size ?? matches[0].size);
  if (Number.isFinite(expected) && received !== expected) {
    throw new Error(`received ${received} of ${expected} bytes.`);
  }

  return { title: name, version: 'file', content };
}
