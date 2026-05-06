export type DemoReadinessStatus = "ready" | "missing" | "blocked";

export type DemoReadinessCheck = {
  id: string;
  label: string;
  status: DemoReadinessStatus;
  configured: boolean;
  enabled?: boolean;
  mode: string;
  missingCount: number;
  detail: string;
  diagnostics?: Array<{
    label: string;
    value: string;
  }>;
};

export type DemoReadinessResponse = {
  product?: string;
  generatedAt?: string;
  overall?: {
    ready: boolean;
    readyCount: number;
    total: number;
  };
  checks?: DemoReadinessCheck[];
  error?: string;
};
