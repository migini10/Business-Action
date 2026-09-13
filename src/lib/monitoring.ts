import 'server-only';

/**
 * Module server-only de monitoring système et conteneurs via Prometheus.
 * Ne jamais exposer les URLs internes ou les détails d'infrastructure au client.
 */

export interface MonitoringContainer {
  id: string;
  image: string;
  cpuPercent: number;
  memoryBytes: number;
  status: 'UP' | 'DOWN';
}

export interface MonitoringTargets {
  prometheus: 'UP' | 'DOWN';
  node_exporter: 'UP' | 'DOWN';
  cadvisor: 'UP' | 'DOWN';
}

export interface MonitoringData {
  timestamp: string;
  serverUp: boolean;
  cpuPercent: number | null;
  ramPercent: number | null;
  swapPercent: number | null;
  diskPercent: number | null;
  diskFreeBytes: number | null;
  load1: number | null;
  networkRxBps: number | null;
  networkTxBps: number | null;
  targets: MonitoringTargets;
  containers: MonitoringContainer[];
  error?: string;
}

const PROMETHEUS_TIMEOUT_MS = 3000;

function getPrometheusUrl(): string {
  return process.env.PROMETHEUS_URL || 'http://prometheus:9090';
}

/**
 * Nettoie le nom de l'image Docker pour un affichage lisible
 */
export function cleanImageName(rawImage: string): string {
  if (!rawImage) return 'unknown';
  // Ex: docker.io/library/node:22-bookworm -> node:22-bookworm
  // Ex: gcr.io/cadvisor/cadvisor:v0.51.0 -> cadvisor:v0.51.0
  // Ex: docker.io/prom/prometheus:v2.51.0 -> prometheus:v2.51.0
  const parts = rawImage.split('/');
  return parts[parts.length - 1] || rawImage;
}

/**
 * Exécute une requête PromQL instantanée avec timeout strict de 3 secondes.
 */
export async function queryPrometheusInstant(query: string, timeoutMs: number = PROMETHEUS_TIMEOUT_MS): Promise<any> {
  const baseUrl = getPrometheusUrl();
  const url = new URL('/api/v1/query', baseUrl);
  url.searchParams.set('query', query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Prometheus HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(`Prometheus query status: ${data.status}`);
    }

    return data.data?.result || [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Récupère et agrège toutes les métriques de monitoring de manière sécurisée et contrôlée.
 */
export async function getMonitoringData(): Promise<MonitoringData> {
  const timestamp = new Date().toISOString();

  try {
    // Exécution parallèle des requêtes clés
    const [
      targetsRes,
      cpuRes,
      ramRes,
      swapRes,
      diskPctRes,
      diskFreeRes,
      load1Res,
      netRxRes,
      netTxRes,
      containerMemRes,
      containerCpuRes,
    ] = await Promise.all([
      queryPrometheusInstant('up'),
      queryPrometheusInstant('100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m])))'),
      queryPrometheusInstant('100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))'),
      queryPrometheusInstant('100 * (1 - (node_memory_SwapFree_bytes / (node_memory_SwapTotal_bytes > 0)))'),
      queryPrometheusInstant('100 * (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))'),
      queryPrometheusInstant('node_filesystem_avail_bytes{mountpoint="/"}'),
      queryPrometheusInstant('node_load1'),
      queryPrometheusInstant('sum(rate(node_network_receive_bytes_total{device!~"lo|docker.*|veth.*|br-.*"}[1m]))'),
      queryPrometheusInstant('sum(rate(node_network_transmit_bytes_total{device!~"lo|docker.*|veth.*|br-.*"}[1m]))'),
      queryPrometheusInstant('container_memory_working_set_bytes{name=~".+"}'),
      queryPrometheusInstant('sum by (name, image) (rate(container_cpu_usage_seconds_total{name=~".+"}[1m])) * 100'),
    ]);

    // Extraction des targets
    const targets: MonitoringTargets = {
      prometheus: 'DOWN',
      node_exporter: 'DOWN',
      cadvisor: 'DOWN',
    };

    if (Array.isArray(targetsRes)) {
      for (const item of targetsRes) {
        const job = item.metric?.job;
        const val = item.value?.[1];
        const isUp = val === '1';
        if (job === 'prometheus') targets.prometheus = isUp ? 'UP' : 'DOWN';
        if (job === 'node_exporter') targets.node_exporter = isUp ? 'UP' : 'DOWN';
        if (job === 'cadvisor') targets.cadvisor = isUp ? 'UP' : 'DOWN';
      }
    }

    const parseNum = (res: any[]): number | null => {
      if (!Array.isArray(res) || res.length === 0) return null;
      const raw = res[0]?.value?.[1];
      const parsed = parseFloat(raw);
      return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
    };

    const parseBytes = (res: any[]): number | null => {
      if (!Array.isArray(res) || res.length === 0) return null;
      const raw = res[0]?.value?.[1];
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    // Agrégation conteneurs cAdvisor
    const containerMap = new Map<string, MonitoringContainer>();

    // Remplir RAM depuis container_memory_working_set_bytes
    if (Array.isArray(containerMemRes)) {
      for (const item of containerMemRes) {
        const rawName = item.metric?.name;
        if (!rawName || rawName === '/') continue;

        const shortId = rawName.length > 12 ? rawName.slice(0, 12) : rawName;
        const image = cleanImageName(item.metric?.image || '');
        const memBytes = parseInt(item.value?.[1] || '0', 10) || 0;

        containerMap.set(shortId, {
          id: shortId,
          image: image || 'inconnu',
          cpuPercent: 0,
          memoryBytes: memBytes,
          status: 'UP',
        });
      }
    }

    // Associer CPU depuis container_cpu_usage_seconds_total
    if (Array.isArray(containerCpuRes)) {
      for (const item of containerCpuRes) {
        const rawName = item.metric?.name;
        if (!rawName || rawName === '/') continue;

        const shortId = rawName.length > 12 ? rawName.slice(0, 12) : rawName;
        const cpuVal = parseFloat(item.value?.[1] || '0') || 0;
        const roundedCpu = Math.round(cpuVal * 100) / 100;

        const existing = containerMap.get(shortId);
        if (existing) {
          existing.cpuPercent = roundedCpu;
        } else {
          const image = cleanImageName(item.metric?.image || '');
          containerMap.set(shortId, {
            id: shortId,
            image: image || 'inconnu',
            cpuPercent: roundedCpu,
            memoryBytes: 0,
            status: 'UP',
          });
        }
      }
    }

    const containers = Array.from(containerMap.values()).sort((a, b) => b.memoryBytes - a.memoryBytes);

    const nodeExporterUp = targets.node_exporter === 'UP';

    return {
      timestamp,
      serverUp: nodeExporterUp,
      cpuPercent: parseNum(cpuRes),
      ramPercent: parseNum(ramRes),
      swapPercent: parseNum(swapRes),
      diskPercent: parseNum(diskPctRes),
      diskFreeBytes: parseBytes(diskFreeRes),
      load1: parseNum(load1Res),
      networkRxBps: parseNum(netRxRes),
      networkTxBps: parseNum(netTxRes),
      targets,
      containers,
    };
  } catch (err: any) {
    // Sécurité : ne jamais renvoyer l'erreur interne ni l'URL Prometheus au client
    return {
      timestamp,
      serverUp: false,
      cpuPercent: null,
      ramPercent: null,
      swapPercent: null,
      diskPercent: null,
      diskFreeBytes: null,
      load1: null,
      networkRxBps: null,
      networkTxBps: null,
      targets: {
        prometheus: 'DOWN',
        node_exporter: 'DOWN',
        cadvisor: 'DOWN',
      },
      containers: [],
      error: 'Monitoring indisponible',
    };
  }
}
