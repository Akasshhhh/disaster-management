export type ExternalReport = {
  message: string;
  account: { display_name: string };
  created_at: string;
};

export interface CommunityReportProvider {
  fetchReports(
    disasterId: string,
    signal: AbortSignal,
  ): Promise<ExternalReport[]>;
}

export type CommunityReport = {
  content: string;
  user: string;
  created_at: string;
};

export function normalizeReports(reports: ExternalReport[]): CommunityReport[] {
  return reports.map((report) => ({
    content: report.message,
    user: report.account.display_name,
    created_at: new Date(report.created_at).toISOString(),
  }));
}

export class MockCommunityReportProvider implements CommunityReportProvider {
  async fetchReports(
    disasterId: string,
    signal: AbortSignal,
  ): Promise<ExternalReport[]> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 40);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason ?? new Error("Request aborted"));
        },
        { once: true },
      );
    });
    const timestamp = new Date("2026-01-15T12:00:00.000Z").toISOString();
    return [
      {
        message: `Residents near ${disasterId.slice(0, 8)} report rising water on local roads.`,
        account: { display_name: "Community volunteer" },
        created_at: timestamp,
      },
      {
        message: "A neighborhood group is coordinating supply drop-offs.",
        account: { display_name: "Response network" },
        created_at: timestamp,
      },
    ];
  }
}
