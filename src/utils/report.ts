import { TestReport, TestResult } from '../types/ssd';

type OverallStatus = 'SUCCESS' | 'PARTIAL' | 'FAILURE';

export interface ReportSummaryView {
  totalTests: number;
  passed: number;
  failed: number;
  blocked: number;
  durationMs: number | null;
  consentProfiles: string[];
  overallStatus: OverallStatus;
}

function countResults(results: TestResult[]) {
  const passed = results.filter(result => result.status === 'PASS').length;
  const failed = results.filter(result => result.status === 'FAIL').length;
  return { passed, failed };
}

export function buildReportSummary(report: TestReport | null): ReportSummaryView {
  if (!report) {
    return {
      totalTests: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      durationMs: null,
      consentProfiles: [],
      overallStatus: 'PARTIAL',
    };
  }

  // NEW LOGIC: Handle the new report structure with cookie and pdf
  if (report.cookie || report.pdf) {
    const cookieStatus = report.cookie?.status || 'UNKNOWN';
    const pdfStatus = report.pdf?.status || 'UNKNOWN';
    
    // Count tests: 1 for cookie + 1 for PDF = 2 total
    const totalTests = 2;
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    
    if (cookieStatus === 'PASS') passed++;
    else if (cookieStatus === 'FAIL' || cookieStatus === 'ERROR') failed++;
    else if (cookieStatus === 'BLOCKED') blocked++;
    
    if (pdfStatus === 'PASS') passed++;
    else if (pdfStatus === 'FAIL' || pdfStatus === 'ERROR') failed++;
    else if (pdfStatus === 'BLOCKED') blocked++;
    
    const durationMs = (report.cookie?.duration || 0) + (report.pdf?.duration || 0);
    const consentProfiles = report.cookie?.consentStatus ? [report.cookie.consentStatus] : [];
    
    let overallStatus: OverallStatus = 'PARTIAL';
    if (blocked > 0 || failed > 0) {
      overallStatus = 'FAILURE';
    } else if (passed === totalTests) {
      overallStatus = 'SUCCESS';
    }
    
    return {
      totalTests,
      passed,
      failed,
      blocked,
      durationMs,
      consentProfiles,
      overallStatus,
    };
  }

  // FALLBACK: Handle old report structure
  const results = report.results || [];
  const summary = report.summary || null;

  const derivedCounts = countResults(results);

  const totalFromSummary = typeof summary?.steps === 'number' ? summary.steps : results.length;
  const passedFromSummary = typeof summary?.passed === 'number' ? summary.passed : derivedCounts.passed;
  const failedFromSummary = typeof summary?.failed === 'number'
    ? summary.failed
    : Math.max(totalFromSummary - passedFromSummary, derivedCounts.failed);

  const totalTests = totalFromSummary;
  const passed = passedFromSummary;
  const failed = failedFromSummary;
  const durationMs = typeof summary?.duration === 'number' ? summary.duration : null;
  const consentProfiles = summary && Array.isArray(summary.consentProfiles)
    ? summary.consentProfiles
    : [];

  let overallStatus: OverallStatus = 'PARTIAL';
  if (totalTests === 0) {
    overallStatus = failed > 0 ? 'FAILURE' : 'PARTIAL';
  } else if (failed === 0) {
    overallStatus = 'SUCCESS';
  } else if (failed >= totalTests) {
    overallStatus = 'FAILURE';
  }

  return {
    totalTests,
    passed,
    failed,
    blocked: 0,
    durationMs,
    consentProfiles,
    overallStatus,
  };
}
