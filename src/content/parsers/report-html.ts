/** Remove report controls without flattening headings, tables, links or code. */
export function reportHtml(node: Element): string {
  const copy = node.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('button, svg, script, style, mat-icon, nav').forEach(ui => ui.remove());
  return copy.innerHTML;
}

export function sourceLinksHtml(root: Element): string {
  const doc = root.ownerDocument;
  const links = new Map<string, string>();
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
    if (/^https?:/.test(link.href)) {
      const copy = link.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('svg, mat-icon').forEach(icon => icon.remove());
      links.set(link.href, copy.textContent?.trim() || link.href);
    }
  });
  if (!links.size) return '';
  const section = doc.createElement('section');
  const heading = doc.createElement('h2');
  heading.textContent = 'Research sources';
  section.append(heading);
  const list = doc.createElement('ul');
  for (const [url, title] of links) {
    const item = doc.createElement('li');
    const link = doc.createElement('a');
    link.href = url;
    link.textContent = title;
    item.append(link);
    list.append(item);
  }
  section.append(list);
  return section.outerHTML;
}
