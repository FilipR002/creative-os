// ─── Phase 7 — Product Layer Types (frontend) ────────────────────────────────
// Mirror of src/product/user/product.types.ts.
// These are the ONLY types the creator UI imports — no engine types ever.

export interface ProductOutput {
  title:                 string;
  primaryRecommendation: string;
  alternatives:          string[];
  explanation:           string;
  confidence:            number;   // 0–100
  category:              string;
}

export interface ProductGenerateResult {
  projectId:   string;
  output:      ProductOutput;
  generatedAt: string;
}

export interface ProductProject {
  id:          string;
  name:        string;
  goal:        string;
  context:     string;
  clientId:    string;
  createdAt:   string;
  lastResult?: ProductGenerateResult;
}
