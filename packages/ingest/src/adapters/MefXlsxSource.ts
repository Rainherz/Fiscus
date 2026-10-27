import { setTimeout as delay } from "node:timers/promises";
import type { InvestmentSource, SourceReport } from "../ports/InvestmentSource.js";
import { parseSsiReport } from "./ssiReportParser.js";

export const MEF_SSI_ENDPOINT = "https://ofi5.mef.gob.pe/inviertews/Ssi/expRepSSIDet";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** XLSX files are ZIP archives and start with "PK\x03\x04". */
function looksLikeXlsx(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export interface MefXlsxSourceOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<unknown>;
  /** Per-attempt timeout. The endpoint routinely takes ~50s. */
  timeoutMs?: number;
  /** Retries after the first attempt. */
  retries?: number;
  /** Base delay for exponential backoff between attempts. */
  backoffMs?: number;
  /** Investment type filter; "GR" = regional governments. */
  governmentType?: string;
}

/**
 * Downloads the SSI XLSX report per department from MEF.
 * TLS: the server ships an incomplete chain; run with NODE_EXTRA_CA_CERTS pointing to
 * certs/entrust-ov-tls-issuing-rsa-ca2.pem instead of disabling verification.
 */
export class MefXlsxSource implements InvestmentSource {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<unknown>;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly governmentType: string;

  constructor(options: MefXlsxSourceOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? ((ms) => delay(ms));
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.retries = options.retries ?? 3;
    this.backoffMs = options.backoffMs ?? 5_000;
    this.governmentType = options.governmentType ?? "GR";
  }

  async fetchDepartment(departmentCode: number): Promise<SourceReport> {
    const bytes = await this.downloadWithRetry(departmentCode);
    const { sourceUpdatedAt, pimYear, records } = await parseSsiReport(bytes);
    return { sourceUpdatedAt, pimYear, records };
  }

  private async downloadWithRetry(departmentCode: number): Promise<Uint8Array> {
    const attempts = this.retries + 1;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.download(departmentCode);
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await this.sleep(this.backoffMs * 2 ** (attempt - 1));
      }
    }
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`MEF download failed for department ${departmentCode} after ${attempts} attempts: ${reason}`);
  }

  private async download(departmentCode: number): Promise<Uint8Array> {
    const response = await this.fetchImpl(MEF_SSI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        Origin: "https://ofi5.mef.gob.pe",
        Referer: "https://ofi5.mef.gob.pe/ssi/Ssi/Index",
        "User-Agent": BROWSER_USER_AGENT,
      },
      body: JSON.stringify({
        sect: "",
        plie: String(departmentCode),
        dpto: 0,
        prov: 0,
        dist: 0,
        tipo: this.governmentType,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!looksLikeXlsx(bytes)) throw new Error("response is not an xlsx file");
    return bytes;
  }
}
