// src/services/apiService.ts

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

interface AnalysisRequest {
  url: string;
  options?: {
    multiStep?: boolean;
    includeScreenshots?: boolean;
    includePerformance?: boolean;
    includeAccessibility?: boolean;
    includeSeo?: boolean;
  };
}

interface AnalysisResponse {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

class ApiService {
  private baseUrl = 'http://localhost:4001/api';
  private requests = new Map<string, AnalysisResponse>();

  async analyzeWebsite(request: AnalysisRequest): Promise<ApiResponse<AnalysisResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Store the request for tracking
      this.requests.set(data.id, data);

      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async getAnalysisStatus(id: string): Promise<ApiResponse<AnalysisResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze/${id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Update stored request
      this.requests.set(id, data);

      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async getAnalysisHistory(limit: number = 50): Promise<ApiResponse<AnalysisResponse[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze/history?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async deleteAnalysis(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Remove from local storage
      this.requests.delete(id);

      return {
        success: true,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async getMonitoringConfigs(): Promise<ApiResponse<any[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/monitoring/configs`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async createMonitoringConfig(config: any): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/monitoring/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async getMonitoringResults(url: string, hours: number = 24): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/monitoring/results/${encodeURIComponent(url)}?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void): WebSocket | null {
    try {
      const ws = new WebSocket('ws://localhost:4001/ws');
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
      };

      return ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      return null;
    }
  }

  // Get stored request
  getStoredRequest(id: string): AnalysisResponse | null {
    return this.requests.get(id) || null;
  }

  // Get all stored requests
  getAllStoredRequests(): AnalysisResponse[] {
    return Array.from(this.requests.values());
  }
}

export const apiService = new ApiService();
