export interface QueryLogEntry {
  sql: string;
  params: unknown[];
  action: string;
  durationMs: number;
  timestamp: string;
}

class QueryTracker {
  private logs: QueryLogEntry[] = [];
  private enabled: boolean = true;

  public record(sql: string, params: unknown[], action: string, durationMs: number) {
    if (!this.enabled) return;
    this.logs.push({
      sql: sql.trim().replace(/\s+/g, ' '),
      params,
      action,
      durationMs,
      timestamp: new Date().toISOString(),
    });
    if (this.logs.length > 200) {
      this.logs.shift();
    }
  }

  public getRecentLogs(limit = 20): QueryLogEntry[] {
    return [...this.logs].slice(-limit).reverse();
  }

  public clear() {
    this.logs = [];
  }
}

export const queryTracker = new QueryTracker();
