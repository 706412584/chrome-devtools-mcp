/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser discovery and instance management tools.
 * Helps find running Chrome instances and persistent profiles
 * so users don't need to re-login every session.
 */

import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {zod} from '../third_party/index.js';

import {ToolCategory} from './categories.js';
import {defineTool} from './ToolDefinition.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readDevToolsActivePort(
  userDataDir: string,
): Promise<{port: number; path: string} | null> {
  try {
    const content = await fs.readFile(
      path.join(userDataDir, 'DevToolsActivePort'),
      'utf8',
    );
    const lines = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => !!l);
    if (lines.length >= 2) {
      const port = parseInt(lines[0], 10);
      if (!isNaN(port) && port > 0 && port <= 65535) {
        return {port, path: lines[1]};
      }
    }
  } catch {
    // No DevToolsActivePort file
  }
  return null;
}

async function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(url, {signal: controller.signal});
    clearTimeout(timeout);
    if (resp.ok) {
      return (await resp.json()) as Record<string, unknown>;
    }
  } catch {
    // not available
  }
  return null;
}

interface ChromeInstance {
  source: string;
  userDataDir?: string;
  port?: number;
  wsEndpoint?: string;
  browserVersion?: string;
  activeProfile?: string;
  persistent: boolean;
}

// ─── Common Chrome userDataDir locations ─────────────────────────────────────

function getChromeProfileDirs(): string[] {
  const home = os.homedir();
  const platform = os.platform();

  const dirs: string[] = [];

  if (platform === 'win32') {
    // Windows: Chrome profiles
    const localAppData =
      process.env['LOCALAPPDATA'] ?? path.join(home, 'AppData', 'Local');
    dirs.push(path.join(localAppData, 'Google', 'Chrome', 'User Data'));
    // Edge
    dirs.push(path.join(localAppData, 'Microsoft', 'Edge', 'User Data'));
  } else if (platform === 'darwin') {
    // macOS
    dirs.push(
      path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
    );
    dirs.push(
      path.join(home, 'Library', 'Application Support', 'Microsoft Edge'),
    );
  } else {
    // Linux
    dirs.push(path.join(home, '.config', 'google-chrome'));
    dirs.push(path.join(home, '.config', 'chromium'));
    dirs.push(path.join(home, '.config', 'microsoft-edge'));
  }

  // MCP's own persistent profiles
  dirs.push(path.join(home, '.cache', 'chrome-devtools-mcp', 'chrome-profile'));
  dirs.push(
    path.join(home, '.cache', 'chrome-devtools-mcp-cli', 'chrome-profile'),
  );

  return dirs;
}

// ─── browser_discover ───────────────────────────────────────────────────────

export const browserDiscover = defineTool({
  name: 'browser_discover',
  description:
    'Discover available Chrome/Edge browser instances and profiles. ' +
    'Finds: (1) Running Chrome instances with debug ports, (2) MCP persistent profiles with saved sessions, ' +
    'system Chrome profiles. Use the returned --userDataDir or --wsEndpoint to reconnect.',
  annotations: {
    category: ToolCategory.NAVIGATION,
    readOnlyHint: true,
  },
  schema: {},
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (_request, response) => {
    const instances: ChromeInstance[] = [];

    // 1. Check MCP persistent profiles
    const mcpProfiles = [
      path.join(
        os.homedir(),
        '.cache',
        'chrome-devtools-mcp',
        'chrome-profile',
      ),
      path.join(
        os.homedir(),
        '.cache',
        'chrome-devtools-mcp-cli',
        'chrome-profile',
      ),
    ];

    for (const profileDir of mcpProfiles) {
      const activePort = await readDevToolsActivePort(profileDir);
      if (activePort) {
        instances.push({
          source: 'MCP persistent profile',
          userDataDir: profileDir,
          port: activePort.port,
          wsEndpoint: `ws://127.0.0.1:${activePort.port}${activePort.path}`,
          persistent: true,
        });
      } else if (await fileExists(profileDir)) {
        // Profile exists but Chrome isn't running with it
        instances.push({
          source: 'MCP profile (not running)',
          userDataDir: profileDir,
          persistent: true,
        });
      }
    }

    // 2. Scan common debug ports
    const commonPorts = [9222, 9223, 9224, 9229, 9333];
    for (const port of commonPorts) {
      if (await isPortOpen(port)) {
        const json = await fetchJson(`http://127.0.0.1:${port}/json/version`);
        if (json) {
          const wsUrl = json.webSocketDebuggerUrl as string | undefined;
          const version = json.Browser as string | undefined;
          // Avoid duplicates if already found via DevToolsActivePort
          if (!instances.some(i => i.port === port)) {
            instances.push({
              source: 'Running Chrome (debug port)',
              port,
              wsEndpoint: wsUrl,
              browserVersion: version,
              persistent: false,
            });
          }
        }
      }
    }

    // 3. List system Chrome profiles
    const profileDirs = getChromeProfileDirs();
    for (const baseDir of profileDirs) {
      try {
        const entries = await fs.readdir(baseDir);
        for (const entry of entries) {
          // Chrome profile dirs start with "Default", "Profile 1", "Profile 2", etc.
          if (
            entry === 'Default' ||
            entry === 'Profile 1' ||
            entry === 'Profile 2' ||
            entry === 'Guest Profile' ||
            /^Profile \d+$/.test(entry)
          ) {
            const profilePath = path.join(baseDir, entry);
            const stat = await fs.stat(profilePath);
            if (stat.isDirectory()) {
              instances.push({
                source: `System profile (${baseDir.split(path.sep).slice(-2).join('/')})`,
                userDataDir: baseDir,
                activeProfile: entry,
                persistent: true,
              });
            }
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // Format output
    if (instances.length === 0) {
      response.appendResponseLine('No Chrome instances or profiles found.');
      response.appendResponseLine('');
      response.appendResponseLine('To create a persistent profile:');
      response.appendResponseLine(
        '  1. Start Chrome with: chrome --remote-debugging-port=9222',
      );
      response.appendResponseLine(
        '  2. Or use MCP without --isolated flag to auto-persist',
      );
      return;
    }

    response.appendResponseLine(
      `Found ${instances.length} browser instances/profiles:`,
    );
    response.appendResponseLine('');

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const status = inst.port ? `[RUNNING :${inst.port}]` : '[NOT RUNNING]';
      response.appendResponseLine(`${i + 1}. ${status} ${inst.source}`);
      if (inst.browserVersion) {
        response.appendResponseLine(`   Version: ${inst.browserVersion}`);
      }
      if (inst.userDataDir) {
        response.appendResponseLine(`   userDataDir: ${inst.userDataDir}`);
      }
      if (inst.activeProfile) {
        response.appendResponseLine(`   Profile: ${inst.activeProfile}`);
      }
      if (inst.wsEndpoint) {
        response.appendResponseLine(`   wsEndpoint: ${inst.wsEndpoint}`);
      }
      response.appendResponseLine(
        `   Persistent: ${inst.persistent ? 'Yes (session saved)' : 'No'}`,
      );
      response.appendResponseLine('');
    }

    response.appendResponseLine('To reuse a profile (no re-login needed):');
    response.appendResponseLine('  Update plugin.json args to include:');
    response.appendResponseLine('  --userDataDir "<path from above>"');
    response.appendResponseLine('');
    response.appendResponseLine('To connect to a running instance:');
    response.appendResponseLine('  --wsEndpoint "<wsEndpoint from above>"');
  },
});

// ─── browser_connect ────────────────────────────────────────────────────────
// Provides a quick way to generate the plugin config for a specific instance.

export const browserConnect = defineTool({
  name: 'browser_connect',
  description:
    'Generate the plugin configuration to connect to a specific Chrome instance. ' +
    'Takes a userDataDir path or wsEndpoint and outputs the plugin.json args needed. ' +
    'Use browser_discover first to find available instances.',
  annotations: {
    category: ToolCategory.NAVIGATION,
    readOnlyHint: true,
  },
  schema: {
    userDataDir: zod
      .string()
      .optional()
      .describe('Path to Chrome user data directory to connect to.'),
    wsEndpoint: zod
      .string()
      .optional()
      .describe(
        'WebSocket endpoint to connect to (e.g., ws://127.0.0.1:9222/devtools/browser/xxx).',
      ),
    profile: zod
      .string()
      .optional()
      .describe(
        'Chrome profile name within the userDataDir (e.g., "Default", "Profile 1").',
      ),
  },
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (_request, response) => {
    const {userDataDir, wsEndpoint, profile} = _request.params;

    if (!userDataDir && !wsEndpoint) {
      throw new Error('Either userDataDir or wsEndpoint must be provided.');
    }

    response.appendResponseLine('Plugin configuration for reconnection:');
    response.appendResponseLine('');

    if (wsEndpoint) {
      response.appendResponseLine(
        'Option A — Direct WebSocket (recommended for running instances):',
      );
      response.appendResponseLine('```json');
      response.appendResponseLine(
        JSON.stringify(
          {
            mcpServers: {
              'chrome-devtools': {
                command: 'node',
                args: [
                  'D:\\Marker\\chrome-devtools-mcp\\build\\src\\bin\\chrome-devtools-mcp.js',
                  '--wsEndpoint',
                  wsEndpoint,
                ],
              },
            },
          },
          null,
          2,
        ),
      );
      response.appendResponseLine('```');
    }

    if (userDataDir) {
      const args = [
        'D:\\Marker\\chrome-devtools-mcp\\build\\src\\bin\\chrome-devtools-mcp.js',
        '--userDataDir',
        userDataDir,
      ];
      if (profile && profile !== 'Default') {
        args.push('--profile', profile);
      }
      args.push('--experimentalVision');

      response.appendResponseLine(
        'Option B — Persistent userDataDir (survives restarts):',
      );
      response.appendResponseLine('```json');
      response.appendResponseLine(
        JSON.stringify(
          {
            mcpServers: {
              'chrome-devtools': {
                command: 'node',
                args,
              },
            },
          },
          null,
          2,
        ),
      );
      response.appendResponseLine('```');
    }

    response.appendResponseLine('');
    response.appendResponseLine(
      'Copy the relevant config into your plugin.json file.',
    );
    response.appendResponseLine(
      'The session (cookies, login state) will persist across restarts.',
    );
  },
});
