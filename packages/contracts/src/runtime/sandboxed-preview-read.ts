export function isSandboxedPreviewRead(method: string, pathname: string): boolean {
  return method === 'GET' && (
    /^\/projects\/[^/]+\/(?:raw|preview)\/|^\/codex-pets\/[^/]+\/spritesheet$|^\/asset-cache$/.test(pathname)
    || /^\/design-systems\/[^/]+\/static\/previews\/[A-Za-z0-9_-]+\/files\//.test(pathname)
  );
}

