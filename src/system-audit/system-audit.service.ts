import { Injectable, Logger } from '@nestjs/common';
import { ENDPOINTS, RegistryEndpoint } from '../registry/registry.controller';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ResolveStrategy =
  | 'wire_ui'
  | 'classify_admin'
  | 'mark_internal'
  | 'generate_ui';

export interface AuditReport {
  orphanEndpoints: RegistryEndpoint[];
  missingUIBindings: RegistryEndpoint[];
  duplicateRoutes: string[];
  classificationSuggestions: {
    visible_ui: RegistryEndpoint[];
    admin_ui:   RegistryEndpoint[];
    internal:   RegistryEndpoint[];
  };
  stats: {
    total:     number;
    connected: number;
    orphans:   number;
    adminOnly: number;
    internal:  number;
  };
  generatedTools: GeneratedToolConfig[];
}

export interface ResolveInput {
  endpointPath: string;
  method:       string;
  strategy:     ResolveStrategy;
}

export interface ResolveResult {
  success:       boolean;
  strategy:      ResolveStrategy;
  endpointPath:  string;
  method:        string;
  action:        string;
  uiLocation?:   string;
  previewUrl?:   string;
  alreadyResolved?: boolean;
}

export interface GeneratedToolConfig {
  name:          string;
  endpointPath:  string;
  method:        string;
  label:         string;
  module:        string;
  uiType:        string;
  createdAt:     string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class SystemAuditService {
  private readonly logger = new Logger(SystemAuditService.name);

  // In-memory store for generated tools (persists while server is running)
  private readonly generatedTools = new Map<string, GeneratedToolConfig>();

  // ── Audit ─────────────────────────────────────────────────────────────────

  runAudit(): AuditReport {
    const all = ENDPOINTS;

    // Orphans: not connected, not hidden_internal, no clientFn OR no uiLocation
    const orphanEndpoints = all.filter(ep =>
      !ep.connected &&
      ep.uiExposure !== 'HIDDEN_INTERNAL' &&
      (ep.uiLocation === 'none' || !ep.uiLocation || ep.notes?.toLowerCase().includes('missing')),
    );

    // Missing UI bindings: has clientFn but no real uiLocation
    const missingUIBindings = all.filter(ep =>
      ep.clientFn &&
      !ep.connected &&
      ep.uiExposure !== 'HIDDEN_INTERNAL' &&
      !orphanEndpoints.some(o => o.path === ep.path && o.method === ep.method),
    );

    // Duplicate routes: same path+method combo appearing more than once
    const seen = new Map<string, number>();
    all.forEach(ep => {
      const key = `${ep.method} ${ep.path}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    const duplicateRoutes = [...seen.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key);

    // Classification suggestions for orphan endpoints
    const suggestions = { visible_ui: [] as RegistryEndpoint[], admin_ui: [] as RegistryEndpoint[], internal: [] as RegistryEndpoint[] };
    orphanEndpoints.forEach(ep => {
      if (this.suggestClassification(ep.path) === 'HIDDEN_INTERNAL') suggestions.internal.push(ep);
      else if (this.suggestClassification(ep.path) === 'ADMIN_UI')   suggestions.admin_ui.push(ep);
      else                                                             suggestions.visible_ui.push(ep);
    });

    const stats = {
      total:     all.length,
      connected: all.filter(e => e.connected).length,
      orphans:   orphanEndpoints.length,
      adminOnly: all.filter(e => e.uiExposure === 'ADMIN_UI').length,
      internal:  all.filter(e => e.uiExposure === 'HIDDEN_INTERNAL').length,
    };

    return {
      orphanEndpoints,
      missingUIBindings,
      duplicateRoutes,
      classificationSuggestions: suggestions,
      stats,
      generatedTools: [...this.generatedTools.values()],
    };
  }

  // ── Resolve ───────────────────────────────────────────────────────────────

  async resolveEndpoint(input: ResolveInput): Promise<ResolveResult> {
    const { endpointPath, method, strategy } = input;

    // Find the endpoint in the registry
    const ep = ENDPOINTS.find(e => e.path === endpointPath && e.method === method);
    if (!ep) {
      return { success: false, strategy, endpointPath, method, action: 'Endpoint not found in registry.' };
    }

    // ── Safety checks ──
    if (ep.connected) {
      return { success: false, strategy, endpointPath, method, action: 'Already connected — resolution blocked.', alreadyResolved: true };
    }
    if (ep.uiExposure === 'HIDDEN_INTERNAL' && strategy !== 'mark_internal') {
      return { success: false, strategy, endpointPath, method, action: 'Already marked internal — no UI action needed.', alreadyResolved: true };
    }

    switch (strategy) {
      case 'wire_ui':     return this.applyWireUI(ep);
      case 'classify_admin': return this.applyClassifyAdmin(ep);
      case 'mark_internal':  return this.applyMarkInternal(ep);
      case 'generate_ui':    return this.applyGenerateUI(ep);
      default:
        return { success: false, strategy, endpointPath, method, action: `Unknown strategy: ${strategy}` };
    }
  }

  async resolveAllOrphans(): Promise<ResolveResult[]> {
    const { orphanEndpoints } = this.runAudit();
    const results: ResolveResult[] = [];

    for (const ep of orphanEndpoints) {
      const strategy = this.defaultStrategy(ep);
      const result   = await this.resolveEndpoint({ endpointPath: ep.path, method: ep.method, strategy });
      results.push(result);
    }

    return results;
  }

  // Get a single generated tool config (for the dynamic viewer page)
  getGeneratedTool(name: string): GeneratedToolConfig | null {
    return this.generatedTools.get(name) ?? null;
  }

  getAllGeneratedTools(): GeneratedToolConfig[] {
    return [...this.generatedTools.values()];
  }

  // ── Private strategies ────────────────────────────────────────────────────

  private applyWireUI(ep: RegistryEndpoint): ResolveResult {
    // Wire to Pro Diagnostics — it already shows ADMIN endpoints, and all orphans with clientFns
    // map best to the admin panel or pro-mode tab
    const uiLocation = ep.uiExposure === 'ADMIN_UI' ? '/pro-mode' : '/system-audit';

    // Mutate registry entry
    ep.connected  = true;
    ep.uiLocation = uiLocation;

    this.logger.log(`wire_ui: ${ep.method} ${ep.path} → ${uiLocation}`);

    return {
      success:      true,
      strategy:     'wire_ui',
      endpointPath: ep.path,
      method:       ep.method,
      action:       `Marked as connected → ${uiLocation}. Client function "${ep.clientFn}" is now registered.`,
      uiLocation,
      previewUrl:   uiLocation,
    };
  }

  private applyClassifyAdmin(ep: RegistryEndpoint): ResolveResult {
    ep.uiExposure = 'ADMIN_UI';
    ep.uiLocation = '/pro-mode';
    ep.connected  = true;

    this.logger.log(`classify_admin: ${ep.method} ${ep.path}`);

    return {
      success:      true,
      strategy:     'classify_admin',
      endpointPath: ep.path,
      method:       ep.method,
      action:       `Reclassified as ADMIN_UI → visible in Pro Diagnostics tab.`,
      uiLocation:   '/pro-mode',
      previewUrl:   '/pro-mode',
    };
  }

  private applyMarkInternal(ep: RegistryEndpoint): ResolveResult {
    ep.uiExposure = 'HIDDEN_INTERNAL';
    ep.connected  = false;
    ep.notes      = (ep.notes ? ep.notes + '; ' : '') + 'Marked internal by system audit';

    this.logger.log(`mark_internal: ${ep.method} ${ep.path}`);

    return {
      success:      true,
      strategy:     'mark_internal',
      endpointPath: ep.path,
      method:       ep.method,
      action:       `Marked HIDDEN_INTERNAL — removed from UI expectations.`,
    };
  }

  private applyGenerateUI(ep: RegistryEndpoint): ResolveResult {
    const name = this.slugify(ep.path);

    // Check if already generated
    if (this.generatedTools.has(name)) {
      const existing = this.generatedTools.get(name)!;
      return {
        success:       false,
        strategy:      'generate_ui',
        endpointPath:  ep.path,
        method:        ep.method,
        action:        `UI already generated at /system-generated/${name}`,
        uiLocation:    `/system-generated/${name}`,
        previewUrl:    `/system-generated/${name}`,
        alreadyResolved: true,
      };
    }

    // Register the generated tool
    const config: GeneratedToolConfig = {
      name,
      endpointPath: ep.path,
      method:       ep.method,
      label:        ep.label,
      module:       ep.module,
      uiType:       ep.uiType,
      createdAt:    new Date().toISOString(),
    };
    this.generatedTools.set(name, config);

    // Update registry
    ep.connected  = true;
    ep.uiLocation = `/system-generated/${name}`;
    ep.uiExposure = 'VISIBLE_UI';

    this.logger.log(`generate_ui: ${ep.method} ${ep.path} → /system-generated/${name}`);

    return {
      success:      true,
      strategy:     'generate_ui',
      endpointPath: ep.path,
      method:       ep.method,
      action:       `Auto-generated UI component at /system-generated/${name}. Template: ${ep.uiType ?? 'panel'}.`,
      uiLocation:   `/system-generated/${name}`,
      previewUrl:   `/system-generated/${name}`,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private suggestClassification(path: string): 'VISIBLE_UI' | 'ADMIN_UI' | 'HIDDEN_INTERNAL' {
    const p = path.toLowerCase();
    if (p.includes('/routing/') || p.includes('/internal') || p.includes('/signal') || p.includes('/feedback')) return 'HIDDEN_INTERNAL';
    if (p.includes('/admin') || p.includes('/audit') || p.includes('/log') || p.includes('/debug') ||
        p.includes('/monitoring') || p.includes('/cost') || p.includes('/memory') || p.includes('/learning') ||
        p.includes('/evolution') || p.includes('/fatigue') || p.includes('/exploration') || p.includes('/emergence') ||
        p.includes('/observability') || p.includes('/global-memory') || p.includes('/creative-ai') || p.includes('/orchestrator'))
      return 'ADMIN_UI';
    return 'VISIBLE_UI';
  }

  private defaultStrategy(ep: RegistryEndpoint): ResolveStrategy {
    const suggested = this.suggestClassification(ep.path);
    if (suggested === 'HIDDEN_INTERNAL')       return 'mark_internal';
    if (suggested === 'ADMIN_UI')              return 'classify_admin';
    if (ep.clientFn && ep.uiLocation !== 'none') return 'wire_ui';
    return 'generate_ui';
  }

  private slugify(path: string): string {
    return path
      .replace(/^\/api\//, '')
      .replace(/[/:]/g, '-')
      .replace(/[^a-z0-9-]/gi, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }
}
