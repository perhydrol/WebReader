// Local security suites can inject scripts and requests into the Chrome page.
// These are not application requests; keep them out of privacy assertions.
export function isInjectedBrowserRequest(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("kaspersky-labs.com");
  } catch {
    return false;
  }
}

export function isInjectedBrowserMessage(message: string): boolean {
  return message.includes("Content-Security-Policy directive");
}
