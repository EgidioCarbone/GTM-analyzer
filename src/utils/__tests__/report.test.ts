import { describe, it, expect } from 'vitest';
import { buildReportSummary } from '../../utils/report';
import { TestReport } from '../../types/ssd';

describe('buildReportSummary', () => {
  it('returns fallback values when report is null', () => {
    const summary = buildReportSummary(null);
    expect(summary).toEqual({
      totalTests: 0,
      passed: 0,
      failed: 0,
      durationMs: null,
      consentProfiles: [],
      overallStatus: 'PARTIAL',
    });
  });

  it('uses summary values when available', () => {
    const report: TestReport = {
      summary: {
        steps: 3,
        passed: 2,
        failed: 1,
        duration: 5000,
        consentProfiles: ['accept']
      },
      results: [
        {
          section: 'Header',
          stepIndex: 0,
          status: 'PASS',
          evidence: {
            screenshotPathOrB64: '',
            dataLayerEvents: [],
            trackingHits: []
          },
          timings: {
            startTime: 0,
            endTime: 0,
            duration: 0
          }
        },
        {
          section: 'Header',
          stepIndex: 1,
          status: 'FAIL',
          evidence: {
            screenshotPathOrB64: '',
            dataLayerEvents: [],
            trackingHits: []
          },
          timings: {
            startTime: 0,
            endTime: 0,
            duration: 0
          }
        }
      ],
      artifacts: {
        screenshotsFolder: '',
        rawLogsPath: ''
      }
    };

    const summary = buildReportSummary(report);
    expect(summary.totalTests).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.durationMs).toBe(5000);
    expect(summary.consentProfiles).toEqual(['accept']);
    expect(summary.overallStatus).toBe('PARTIAL');
  });

  it('derives counts from results when summary is missing', () => {
    const report: TestReport = {
      summary: undefined,
      results: [
        {
          section: 'Flow',
          stepIndex: 0,
          status: 'PASS',
          evidence: {
            screenshotPathOrB64: '',
            dataLayerEvents: [],
            trackingHits: []
          },
          timings: {
            startTime: 0,
            endTime: 0,
            duration: 0
          }
        },
        {
          section: 'Flow',
          stepIndex: 1,
          status: 'FAIL',
          evidence: {
            screenshotPathOrB64: '',
            dataLayerEvents: [],
            trackingHits: []
          },
          timings: {
            startTime: 0,
            endTime: 0,
            duration: 0
          }
        }
      ],
      artifacts: {
        screenshotsFolder: '',
        rawLogsPath: ''
      }
    };

    const summary = buildReportSummary(report);
    expect(summary.totalTests).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.durationMs).toBeNull();
    expect(summary.overallStatus).toBe('PARTIAL');
  });
});
