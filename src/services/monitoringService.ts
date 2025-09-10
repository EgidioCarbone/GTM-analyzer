// src/services/monitoringService.ts

interface MonitoringConfig {
  url: string;
  interval: number; // in milliseconds
  enabled: boolean;
  alertThresholds: {
    performance: number;
    accessibility: number;
    seo: number;
  };
}

interface MonitoringResult {
  timestamp: number;
  url: string;
  scores: {
    performance: number;
    accessibility: number;
    seo: number;
    overall: number;
  };
  alerts: string[];
  status: 'healthy' | 'warning' | 'critical';
}

class MonitoringService {
  private monitors = new Map<string, NodeJS.Timeout>();
  private results = new Map<string, MonitoringResult[]>();
  private configs = new Map<string, MonitoringConfig>();

  startMonitoring(config: MonitoringConfig): void {
    const { url, interval, enabled } = config;
    
    if (!enabled) {
      this.stopMonitoring(url);
      return;
    }

    // Stop existing monitor if any
    this.stopMonitoring(url);

    // Start new monitor
    const monitor = setInterval(async () => {
      try {
        await this.performCheck(url, config);
      } catch (error) {
        console.error(`Monitoring error for ${url}:`, error);
      }
    }, interval);

    this.monitors.set(url, monitor);
    this.configs.set(url, config);
  }

  stopMonitoring(url: string): void {
    const monitor = this.monitors.get(url);
    if (monitor) {
      clearInterval(monitor);
      this.monitors.delete(url);
    }
  }

  private async performCheck(url: string, config: MonitoringConfig): Promise<void> {
    // This would integrate with the websiteChecklist service
    // For now, we'll simulate the check
    const result: MonitoringResult = {
      timestamp: Date.now(),
      url,
      scores: {
        performance: Math.random() * 100,
        accessibility: Math.random() * 100,
        seo: Math.random() * 100,
        overall: Math.random() * 100
      },
      alerts: [],
      status: 'healthy'
    };

    // Check thresholds
    if (result.scores.performance < config.alertThresholds.performance) {
      result.alerts.push(`Performance score below threshold: ${result.scores.performance}`);
      result.status = 'warning';
    }

    if (result.scores.accessibility < config.alertThresholds.accessibility) {
      result.alerts.push(`Accessibility score below threshold: ${result.scores.accessibility}`);
      result.status = 'warning';
    }

    if (result.scores.seo < config.alertThresholds.seo) {
      result.alerts.push(`SEO score below threshold: ${result.scores.seo}`);
      result.status = 'warning';
    }

    // Store result
    if (!this.results.has(url)) {
      this.results.set(url, []);
    }
    
    const urlResults = this.results.get(url)!;
    urlResults.push(result);
    
    // Keep only last 100 results
    if (urlResults.length > 100) {
      urlResults.splice(0, urlResults.length - 100);
    }

    // Trigger alerts if needed
    if (result.alerts.length > 0) {
      this.triggerAlert(url, result);
    }
  }

  private triggerAlert(url: string, result: MonitoringResult): void {
    // This would integrate with notification systems
    console.log(`Alert for ${url}:`, result.alerts);
    
    // Could integrate with:
    // - Email notifications
    // - Slack/Discord webhooks
    // - Push notifications
    // - Dashboard updates
  }

  getResults(url: string): MonitoringResult[] {
    return this.results.get(url) || [];
  }

  getLatestResult(url: string): MonitoringResult | null {
    const results = this.getResults(url);
    return results.length > 0 ? results[results.length - 1] : null;
  }

  getTrends(url: string, hours: number = 24): {
    performance: number[];
    accessibility: number[];
    seo: number[];
    overall: number[];
    timestamps: number[];
  } {
    const results = this.getResults(url);
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    const filteredResults = results.filter(r => r.timestamp >= cutoff);
    
    return {
      performance: filteredResults.map(r => r.scores.performance),
      accessibility: filteredResults.map(r => r.scores.accessibility),
      seo: filteredResults.map(r => r.scores.seo),
      overall: filteredResults.map(r => r.scores.overall),
      timestamps: filteredResults.map(r => r.timestamp)
    };
  }

  getAllMonitoredUrls(): string[] {
    return Array.from(this.configs.keys());
  }

  getConfig(url: string): MonitoringConfig | null {
    return this.configs.get(url) || null;
  }

  updateConfig(url: string, config: Partial<MonitoringConfig>): void {
    const existingConfig = this.configs.get(url);
    if (existingConfig) {
      const updatedConfig = { ...existingConfig, ...config };
      this.configs.set(url, updatedConfig);
      this.startMonitoring(updatedConfig);
    }
  }

  stopAllMonitoring(): void {
    for (const url of this.monitors.keys()) {
      this.stopMonitoring(url);
    }
  }
}

export const monitoringService = new MonitoringService();
