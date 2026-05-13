// Showcase shim for @ursamu/ursamu.
// Re-exports the real package's types but provides offline stubs for the
// runtime surface rhost-vision touches at module load (`addCmd`, `dbojs`,
// `send`, `DBO`, `gameHooks`, `registerPluginRoute`). The showcase runner
// builds its own fake `IUrsamuSDK` for `cmd.exec()` calls — so this shim
// only has to satisfy the imports referenced from `src/`.
// deno-lint-ignore-file no-explicit-any

export type {
  IPlugin,
  IUrsamuSDK,
  IDBObj,
  IDBOBJ,
  SessionEvent,
} from "jsr:@ursamu/ursamu@^2.2";

// ── Command registry ─────────────────────────────────────────────────────────

export const cmds: any[] = [];

export function addCmd(cmd: any): void {
  cmds.push(cmd);
}

// ── In-memory player store ───────────────────────────────────────────────────
// Populated by the runner via `__shimSeed()` so dbojs queries find players.

const _objs: any[] = [];

export function __shimSeed(objs: any[]): void {
  _objs.length = 0;
  for (const o of objs) _objs.push(o);
}

export function __shimObjs(): any[] {
  return _objs;
}

function matches(obj: any, q: Record<string, any>): boolean {
  for (const [k, v] of Object.entries(q)) {
    if (k === "$and" && Array.isArray(v)) {
      if (!v.every((sub) => matches(obj, sub))) return false;
      continue;
    }
    if (k === "$or" && Array.isArray(v)) {
      if (!v.some((sub) => matches(obj, sub))) return false;
      continue;
    }
    const path = k.split(".");
    let cur: any = obj;
    for (const seg of path) cur = cur?.[seg];
    if (v instanceof RegExp) {
      const haystack = cur instanceof Set
        ? [...cur].join(",")
        : Array.isArray(cur)
        ? cur.join(",")
        : String(cur ?? "");
      if (!v.test(haystack)) return false;
    } else if (cur !== v) {
      return false;
    }
  }
  return true;
}

function applyMod(obj: any, op: string, patch: Record<string, any>): void {
  for (const [k, v] of Object.entries(patch)) {
    const path = k.split(".");
    let cur: any = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (cur[path[i]] == null) {
        if (op === "$unset") return;
        cur[path[i]] = {};
      }
      cur = cur[path[i]];
    }
    const leaf = path[path.length - 1];
    if (op === "$set") cur[leaf] = v;
    else if (op === "$unset") delete cur[leaf];
    else if (op === "$inc") cur[leaf] = (cur[leaf] ?? 0) + (v as number);
  }
}

export const dbojs = {
  queryOne(q: Record<string, any>): Promise<any | undefined> {
    return Promise.resolve(_objs.find((o) => matches(o, q)));
  },
  query(q: Record<string, any>): Promise<any[]> {
    return Promise.resolve(_objs.filter((o) => matches(o, q)));
  },
  modify(
    q: Record<string, any>,
    op: string,
    patch: Record<string, any>,
  ): Promise<void> {
    const o = _objs.find((x) => matches(x, q));
    if (o) applyMod(o, op, patch);
    return Promise.resolve();
  },
};

// ── send() output buffer ─────────────────────────────────────────────────────

let _sendSink: ((sids: string[], msg: string) => void) | null = null;

export function __shimSetSendSink(
  fn: ((sids: string[], msg: string) => void) | null,
): void {
  _sendSink = fn;
}

export function send(sids: string[], msg: string): void {
  if (_sendSink) _sendSink(sids, msg);
}

// ── DBO collection (used by theme.ts singleton) ──────────────────────────────

const _collections = new Map<string, any[]>();

export class DBO<T = any> {
  private rows: T[];
  constructor(name: string) {
    if (!_collections.has(name)) _collections.set(name, []);
    this.rows = _collections.get(name) as T[];
  }
  find(q: Record<string, any>): Promise<T[]> {
    return Promise.resolve(this.rows.filter((r) => matches(r, q)));
  }
  create(row: T): Promise<T> {
    this.rows.push(row);
    return Promise.resolve(row);
  }
  update(q: Record<string, any>, patch: T): Promise<void> {
    const i = this.rows.findIndex((r) => matches(r, q));
    if (i >= 0) this.rows[i] = patch;
    return Promise.resolve();
  }
  delete(q: Record<string, any>): Promise<void> {
    const i = this.rows.findIndex((r) => matches(r, q));
    if (i >= 0) this.rows.splice(i, 1);
    return Promise.resolve();
  }
}

// ── No-op hooks / route registration ─────────────────────────────────────────

export const gameHooks = {
  on(_evt: string, _fn: (...a: any[]) => any): void {},
  off(_evt: string, _fn: (...a: any[]) => any): void {},
  emit(_evt: string, ..._args: any[]): void {},
};

export function registerPluginRoute(..._args: any[]): void {}

// ── PluginConfigManager stub ─────────────────────────────────────────────────
// Just enough surface for theme.ts's readEngineConfig() to no-op cleanly
// during showcase runs (no engine config present).

export class PluginConfigManager {
  static getInstance(): PluginConfigManager {
    throw new Error("PluginConfigManager not initialised");
  }
  getPluginConfig(_name: string): Record<string, unknown> | undefined {
    return undefined;
  }
}
