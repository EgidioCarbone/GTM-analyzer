import type { NormalizedEvent } from '../src/types/live-debugger';

export type InsightSeverity = 'info' | 'warning' | 'error';

export interface EventInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  description?: string;
  eventIndex?: number;
  relatedEventKind?: NormalizedEvent['kind'];
  relatedEventName?: string;
  payloadPreview?: any;
  timestamp: number;
  recommendations?: string[];
}

export interface PushQualityMetrics {
  totalPushes: number;
  pushesWithCollect: number;
  averageCollectDelayMs: number | null;
}

export interface GaQualityMetrics {
  totalHits: number;
  hitsWithStatusOK: number;
  missingMeasurementId: number;
  missingEventName: number;
}

export interface AnalyzerState {
  insights: EventInsight[];
  pushMetrics: PushQualityMetrics;
  gaMetrics: GaQualityMetrics;
}

const initialMetrics: AnalyzerState = {
  insights: [],
  pushMetrics: {
    totalPushes: 0,
    pushesWithCollect: 0,
    averageCollectDelayMs: null,
  },
  gaMetrics: {
    totalHits: 0,
    hitsWithStatusOK: 0,
    missingMeasurementId: 0,
    missingEventName: 0,
  },
};

export class EventAnalyzer {
  private state: AnalyzerState = structuredClone(initialMetrics);
  private pendingPushes = new Map<string, { ts: number; payload?: any }>();

  reset() {
    this.state = structuredClone(initialMetrics);
    this.pendingPushes.clear();
  }

  getState(): AnalyzerState {
    return this.state;
  }

  process(event: NormalizedEvent, index: number): AnalyzerState {
    switch (event.kind) {
      case 'datalayer.push':
        this.handleDataLayerPush(event, index);
        break;
      case 'ga4.hit':
        this.handleGa4Hit(event, index);
        break;
      case 'ua.hit':
        this.handleUaHit(event, index);
        break;
      default:
        break;
    }

    return this.state;
  }

  private addInsight(insight: Omit<EventInsight, 'timestamp'>) {
    this.state.insights.push({ ...insight, timestamp: Date.now() });
  }

  private handleDataLayerPush(event: Extract<NormalizedEvent, { kind: 'datalayer.push' }>, index: number) {
    this.state.pushMetrics.totalPushes += 1;

    const payload = Array.isArray(event.payload) ? event.payload[0] : event.payload;
    const pushId = `${event.ts}-${index}`;
    this.pendingPushes.set(pushId, { ts: event.ts, payload });

    if (!payload || typeof payload !== 'object') {
      this.addInsight({
        id: `dl_malformed_${index}`,
        severity: 'error',
        title: 'Payload DataLayer non valido',
        description: 'Il push ricevuto non contiene un oggetto valido. Verifica il codice che invia l’evento.',
        eventIndex: index,
        relatedEventKind: 'datalayer.push',
      });
      return;
    }

    if (!('event' in payload) || typeof payload.event !== 'string' || !payload.event.trim()) {
      this.addInsight({
        id: `dl_missing_event_${index}`,
        severity: 'warning',
        title: 'Campo "event" mancante o vuoto',
        description: 'Aggiungi un nome evento (es. "navigation_click") per facilitare il tracciamento.',
        eventIndex: index,
        relatedEventKind: 'datalayer.push',
        payloadPreview: payload,
        relatedEventName: payload?.event,
        recommendations: ['Imposta payload.event a un identifier in snake_case.'],
      });
    }

    if (!('event_category' in payload)) {
      this.addInsight({
        id: `dl_missing_category_${index}`,
        severity: 'info',
        title: 'Categoria evento non specificata',
        description: 'Considera di aggiungere "event_category" per classificare il push.',
        eventIndex: index,
        relatedEventKind: 'datalayer.push',
        payloadPreview: payload,
        relatedEventName: payload?.event,
      });
    }
  }

  private handleGa4Hit(event: Extract<NormalizedEvent, { kind: 'ga4.hit' }>, index: number) {
    this.state.gaMetrics.totalHits += 1;
    if (!event.status || event.status < 400) {
      this.state.gaMetrics.hitsWithStatusOK += 1;
    }

    const eventName = event.event?.name?.trim();
    if (!eventName) {
      this.state.gaMetrics.missingEventName += 1;
      this.addInsight({
        id: `ga4_missing_name_${index}`,
        severity: 'warning',
        title: 'Hit GA4 senza event name',
        description: 'Il parametro "en"/"_en" non è presente. L’evento potrebbe non essere tracciato correttamente.',
        eventIndex: index,
        relatedEventKind: 'ga4.hit',
        payloadPreview: event.event,
      });
    }

    if (!event.mi) {
      this.state.gaMetrics.missingMeasurementId += 1;
      this.addInsight({
        id: `ga4_missing_measurement_${index}`,
        severity: 'warning',
        title: 'Measurement ID mancante',
        description: 'Assicurati che il tag GA4 invii "measurement_id" o "tid" con ogni richiesta.',
        eventIndex: index,
        relatedEventKind: 'ga4.hit',
        payloadPreview: event.event,
        relatedEventName: eventName,
      });
    }

    // Associate with pending pushes to compute delay and match quality
    this.matchCollectWithPush(event, index, eventName);

    if (event.event?.params) {
      const params = event.event.params;
      if (typeof params.value === 'undefined' && eventName === 'purchase') {
        this.addInsight({
          id: `ga4_purchase_no_value_${index}`,
          severity: 'warning',
          title: 'Evento purchase senza value',
          description: 'Aggiungi il parametro value e currency per i purchase GA4.',
          eventIndex: index,
          relatedEventKind: 'ga4.hit',
          payloadPreview: event.event,
          relatedEventName: eventName,
        });
      }
    }
  }

  private handleUaHit(event: Extract<NormalizedEvent, { kind: 'ua.hit' }>, index: number) {
    this.state.gaMetrics.totalHits += 1;
    if (!event.status || event.status < 400) {
      this.state.gaMetrics.hitsWithStatusOK += 1;
    }

    const params = event.params;
    if (!params.tid) {
      this.state.gaMetrics.missingMeasurementId += 1;
      this.addInsight({
        id: `ua_missing_tid_${index}`,
        severity: 'warning',
        title: 'Hit UA senza Tracking ID',
        description: 'Il parametro tid non è presente nella richiesta UA.',
        eventIndex: index,
      });
    }

    if (!params.ec || !params.ea) {
      this.addInsight({
        id: `ua_missing_category_action_${index}`,
        severity: 'info',
        title: 'Evento UA privo di categoria/azione',
        description: 'Aggiungi i parametri ec (event category) ed ea (event action) per una migliore reportistica.',
        eventIndex: index,
      });
    }
  }

  private matchCollectWithPush(hit: Extract<NormalizedEvent, { kind: 'ga4.hit' }>, index: number, eventName?: string | undefined) {
    if (!eventName) return;

    // naive strategy: find last pending push with same event name
    const entries = Array.from(this.pendingPushes.entries()).reverse();
    for (const [id, pending] of entries) {
      const payloadEvent = pending.payload?.event;
      if (payloadEvent && payloadEvent === eventName) {
        const delay = hit.ts - pending.ts;
        this.pendingPushes.delete(id);
        this.state.pushMetrics.pushesWithCollect += 1;
        if (delay >= 0) {
          if (this.state.pushMetrics.averageCollectDelayMs === null) {
            this.state.pushMetrics.averageCollectDelayMs = delay;
          } else {
            this.state.pushMetrics.averageCollectDelayMs = Math.round(
              (this.state.pushMetrics.averageCollectDelayMs * 0.7 + delay * 0.3)
            );
          }
        }

        if (delay > 7000) {
          this.addInsight({
            id: `collect_delay_${index}`,
            severity: 'info',
            title: 'Collect GA4 lenta',
            description: `L'evento "${eventName}" ha impiegato ${Math.round(delay / 1000)}s a raggiungere GA. Verifica trigger e condizioni del tag.`,
            eventIndex: index,
          });
        }
        return;
      }
    }
  }
}
