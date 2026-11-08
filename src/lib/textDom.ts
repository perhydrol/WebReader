const SOURCE_SELECTOR = "[data-source-start][data-source-end]";

export function sourceElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(SOURCE_SELECTOR)];
}

export function closestSourceElement(node: Node): HTMLElement | undefined {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  return element?.closest<HTMLElement>(SOURCE_SELECTOR) ?? undefined;
}

export function sourceBounds(element: Element): { start: number; end: number } | undefined {
  const start = Number(element.getAttribute("data-source-start"));
  const end = Number(element.getAttribute("data-source-end"));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return { start, end };
}

export function sourceOffsetFromDomPoint(node: Node, offset: number): number | undefined {
  const element = closestSourceElement(node);
  if (!element || !element.contains(node)) return undefined;
  const bounds = sourceBounds(element);
  if (!bounds) return undefined;
  const range = element.ownerDocument.createRange();
  range.setStart(element, 0);
  range.setEnd(node, Math.min(offset, node.nodeType === Node.TEXT_NODE ? (node as Text).length : offset));
  return Math.min(bounds.end, bounds.start + range.toString().length);
}

export function textNodesIn(root: Element): Text[] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current.nodeType === Node.TEXT_NODE && (current as Text).length > 0) nodes.push(current as Text);
  }
  return nodes;
}

export function rangeForLocalOffset(root: Element, start: number, end = start): Range | undefined {
  const nodes = textNodesIn(root);
  if (nodes.length === 0) return undefined;
  const total = nodes.reduce((length, node) => length + node.length, 0);
  const clamp = (value: number) => Math.min(total, Math.max(0, Math.floor(value)));
  const locate = (value: number): { node: Text; offset: number } => {
    let remaining = clamp(value);
    for (const node of nodes) {
      if (remaining <= node.length) return { node, offset: remaining };
      remaining -= node.length;
    }
    const last = nodes[nodes.length - 1]!;
    return { node: last, offset: last.length };
  };
  const from = locate(start);
  const to = locate(end);
  const range = root.ownerDocument.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

export function rangeRectForLocalOffset(root: Element, offset: number): DOMRect | undefined {
  const forward = rangeForLocalOffset(root, offset, offset + 1);
  const forwardRects = forward ? [...forward.getClientRects()].filter((rect) => rect.width > 0 || rect.height > 0) : [];
  if (forwardRects.length > 0) return forwardRects[0];
  const backward = rangeForLocalOffset(root, Math.max(0, offset - 1), offset);
  const backwardRects = backward ? [...backward.getClientRects()].filter((rect) => rect.width > 0 || rect.height > 0) : [];
  return backwardRects.at(-1);
}

export function sourceOffsetFromDomRange(range: Range): number | undefined {
  const document = range.startContainer.ownerDocument;
  if (!document) return undefined;
  const containing = closestSourceElement(range.startContainer);
  if (containing) {
    const bounds = sourceBounds(containing);
    if (!bounds) return undefined;
    const before = document.createRange();
    before.setStart(containing, 0);
    before.setEnd(range.startContainer, range.startOffset);
    return Math.min(bounds.end, bounds.start + before.toString().length);
  }
  for (const element of sourceElements(document)) {
    const bounds = sourceBounds(element);
    if (!bounds) continue;
    let relation: number;
    try {
      relation = range.comparePoint(element, 0);
    } catch {
      relation = 1;
    }
    if (relation >= 0) return bounds.start;
  }
  return undefined;
}

export function wrapSourceOverlap(element: Element, start: number, end: number): void {
  const bounds = sourceBounds(element);
  if (!bounds) return;
  const localStart = Math.max(0, start - bounds.start);
  const localEnd = Math.min(bounds.end - bounds.start, end - bounds.start);
  if (localEnd <= localStart) return;
  const range = rangeForLocalOffset(element, localStart, localEnd);
  if (!range || range.collapsed) return;
  const mark = element.ownerDocument.createElement("mark");
  mark.className = "text-search-highlight";
  try {
    range.surroundContents(mark);
  } catch {
    const fragment = range.cloneContents();
    mark.append(fragment);
    range.deleteContents();
    range.insertNode(mark);
  }
}

export function clearHighlightMarks(root: ParentNode): void {
  for (const mark of [...root.querySelectorAll<HTMLElement>("mark.text-search-highlight")]) {
    const parent = mark.parentNode;
    if (!parent) continue;
    mark.replaceWith(mark.ownerDocument.createTextNode(mark.textContent ?? ""));
    parent.normalize();
  }
}
