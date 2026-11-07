import type http from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { registerDesignSystemRoutes } from '../../src/routes/design-systems.js';

let server: http.Server | null = null;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

function listen(app: express.Express): Promise<string> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server?.address() as { port: number };
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function registerRoutes(
  app: express.Express,
  staticHtml: string | null,
  files: Record<string, { content: string; contentType: string }> = {},
) {
  registerDesignSystemRoutes(app, {
    db: {} as never,
    paths: {
      CRAFT_DIR: '',
      USER_DESIGN_SYSTEMS_DIR: '',
    } as never,
    projectFiles: {} as never,
    projectStore: {} as never,
    verifyWorkspaceRequestAuthority: async () => {
      throw new Error('unbound fixture must not verify Workspace authority');
    },
    workspaceResources: {
      getWorkspaceResource: () => undefined,
      getWorkspaceResourceByResourceId: () => undefined,
    },
    designSystems: {
      buildUserDesignSystemArchive: async () => null,
      canMutateUserDesignSystem: async () => true,
      createUserDesignSystem: async () => ({}) as never,
      deleteUserDesignSystem: async () => false,
      ensureUserDesignSystemWorkspaceProject: async () => null,
      listAllDesignSystems: async () => [],
      listUserDesignSystemFiles: async () => null,
      listUserDesignSystemRevisions: async () => null,
      prepareDesignTokenContractRebuild: async () => ({ decision: { available: false } }) as never,
      readAvailableDesignSystem: async (id: string) => (id === 'bento' ? '# Bento' : null),
      readAvailableDesignSystemPackageInfo: async () => null,
      readAvailableDesignSystemStaticFile: async (_id: string, filePath: string) => {
        const file = files[filePath] ?? (staticHtml && filePath === 'system/kit.html'
          ? { content: staticHtml, contentType: 'text/html; charset=utf-8' }
          : null);
        return file ? {
          bytes: Buffer.from(file.content, 'utf8'),
          contentType: file.contentType,
          updatedAt: 'Tue, 30 Jun 2026 00:00:00 GMT',
        } : null;
      },
      readDesignSystemWorkspaceTextFile: async () => null,
      readUserDesignSystemFile: async () => null,
      renderDesignSystemPreview: () => '<!doctype html><title>preview</title>',
      renderDesignSystemShowcase: (id: string, body: string) =>
        `<!doctype html><title>${id} synthetic</title><main>${body}</main>`,
      syncUserDesignSystemAssetsFromWorkspace: async () => ({ ok: false, reason: 'not-found' }),
      unshareTeamDesignSystemIfShared: async () => false,
      updateUserDesignSystem: async () => null,
      updateUserDesignSystemRevisionStatus: async () => null,
    },
    generationJobs: {
      get: () => null,
      rebuildTokenContract: () => ({}) as never,
      revise: () => ({}) as never,
      start: () => ({}) as never,
    },
  });
}

describe('design-system showcase route', () => {
  it('serves packaged kit HTML at a URL that resolves relative package assets', async () => {
    const app = express();
    registerRoutes(
      app,
      [
        '<!doctype html>',
        '<link rel="stylesheet" href="../tokens.css">',
        '<img src="./assets/logo.svg">',
        '<style>@font-face{src:url("../fonts/display.woff2?v=1")}</style>',
      ].join(''),
      {
        'tokens.css': { content: 'body{}', contentType: 'text/css' },
        'system/assets/logo.svg': { content: '<svg/>', contentType: 'image/svg+xml' },
        'fonts/display.woff2': { content: 'font', contentType: 'font/woff2' },
      },
    );
    const baseUrl = await listen(app);

    const res = await fetch(`${baseUrl}/api/design-systems/bento/showcase`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('href="../tokens.css"');
    for (const ref of ['../tokens.css', './assets/logo.svg', '../fonts/display.woff2?v=1']) {
      expect((await fetch(new URL(ref, res.url))).status, ref).toBe(200);
    }
    expect(html).not.toContain('bento synthetic');
  });

  it('resolves nested static HTML, CSS imports, modules and navigation from the package directory', async () => {
    const app = express();
    registerRoutes(app, null, {
      'pages/index.html': { content: '<link href="../assets/main.css"><a href="nested/page.html">Next</a>', contentType: 'text/html' },
      'pages/nested/page.html': { content: '<script type="module" src="../../assets/main.mjs"></script>', contentType: 'text/html' },
      'assets/main.css': { content: '@import "./nested/theme.css";', contentType: 'text/css' },
      'assets/nested/theme.css': { content: 'body{color:red}', contentType: 'text/css' },
      'assets/main.mjs': { content: 'import "./nested/helper.mjs";', contentType: 'text/javascript' },
      'assets/nested/helper.mjs': { content: 'export const ready = true;', contentType: 'text/javascript' },
    });
    const baseUrl = await listen(app);
    const page = await fetch(`${baseUrl}/api/design-systems/bento/static?path=pages%2Findex.html`);
    expect(page.status).toBe(200);
    const css = await fetch(new URL('../assets/main.css', page.url));
    expect(css.status).toBe(200);
    expect(await css.text()).toBe('@import "./nested/theme.css";');
    const theme = await fetch(new URL('./nested/theme.css', css.url));
    expect(theme.status).toBe(200);
    const next = await fetch(new URL('nested/page.html', page.url));
    expect(next.status).toBe(200);
    const module = await fetch(new URL('../../assets/main.mjs', next.url));
    expect(module.status).toBe(200);
    const helper = await fetch(new URL('./nested/helper.mjs', module.url));
    expect(helper.status).toBe(200);
    expect(await helper.text()).toBe('export const ready = true;');
  });

  it('preserves encoded filenames and non-scope query values through the legacy entry', async () => {
    const app = express();
    registerRoutes(app, null, {
      'pages/色 彩#%.html': { content: '<h1>Encoded</h1>', contentType: 'text/html' },
    });
    const baseUrl = await listen(app);
    const response = await fetch(`${baseUrl}/api/design-systems/bento/static?${new URLSearchParams({
      path: 'pages/色 彩#%.html',
      mode: 'dark',
    })}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<h1>Encoded</h1>');
    expect(new URL(response.url).searchParams.get('mode')).toBe('dark');
    expect(decodeURIComponent(new URL(response.url).pathname)).toContain('/pages/色 彩#%.html');
  });

  it('does not redirect missing or disallowed files', async () => {
    const app = express();
    registerRoutes(app, null);
    const baseUrl = await listen(app);
    for (const file of ['missing.html', '../secret.txt', 'metadata.json', '.od-generated.json']) {
      const response = await fetch(`${baseUrl}/api/design-systems/bento/static?path=${encodeURIComponent(file)}`, { redirect: 'manual' });
      expect(response.status, file).toBe(404);
      expect(response.headers.get('location'), file).toBeNull();
    }
  });

  it('allows sandboxed module reads without exposing other origins', async () => {
    const app = express();
    registerRoutes(app, null, {
      'assets/main.mjs': { content: 'export const ready = true;', contentType: 'text/javascript' },
    });
    const baseUrl = await listen(app);
    const url = `${baseUrl}/api/design-systems/bento/static?path=assets/main.mjs`;
    const response = await fetch(url, { headers: { Origin: 'null' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
    for (const headers of [{}, { Origin: 'https://example.com' }]) {
      const other = await fetch(url, { headers });
      expect(other.headers.get('access-control-allow-origin')).toBeNull();
    }
  });

  it('keeps the generated showcase fallback when no packaged kit exists', async () => {
    const app = express();
    registerRoutes(app, null);
    const baseUrl = await listen(app);

    const res = await fetch(`${baseUrl}/api/design-systems/bento/showcase`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('bento synthetic');
  });
});
