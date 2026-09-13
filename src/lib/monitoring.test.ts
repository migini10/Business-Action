import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock server-only in test runner (reproduces Next.js react-server condition mapping to empty.js)
(require.cache as any)[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
};

const { cleanImageName, getMonitoringData } = require('./monitoring');
const { GET } = require('@/app/api/admin/monitoring/route');

describe('Admin Monitoring Service & API', () => {
  let originalFetch: typeof global.fetch;
  let originalEnvProm: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnvProm = process.env.PROMETHEUS_URL;
    process.env.PROMETHEUS_URL = 'http://mock-prometheus:9090';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnvProm !== undefined) {
      process.env.PROMETHEUS_URL = originalEnvProm;
    } else {
      delete process.env.PROMETHEUS_URL;
    }
  });

  describe('cleanImageName', () => {
    it('nettoie les préfixes de registre docker et hub', () => {
      assert.strictEqual(cleanImageName('docker.io/library/node:22-bookworm'), 'node:22-bookworm');
      assert.strictEqual(cleanImageName('gcr.io/cadvisor/cadvisor:v0.51.0'), 'cadvisor:v0.51.0');
      assert.strictEqual(cleanImageName('docker.io/prom/prometheus:v2.51.0'), 'prometheus:v2.51.0');
      assert.strictEqual(cleanImageName('postgres:16'), 'postgres:16');
      assert.strictEqual(cleanImageName(''), 'unknown');
    });
  });

  describe('getMonitoringData - Cas nominal', () => {
    it('calcule et retourne correctement toutes les métriques serveur, targets et conteneurs', async () => {
      global.fetch = async (input: RequestInfo | URL) => {
        const urlStr = input.toString();
        const url = new URL(urlStr);
        const query = url.searchParams.get('query') || '';

        let result: any[] = [];

        if (query === 'up') {
          result = [
            { metric: { job: 'prometheus', instance: 'localhost:9090' }, value: [1700000000, '1'] },
            { metric: { job: 'node_exporter', instance: 'node_exporter:9100' }, value: [1700000000, '1'] },
            { metric: { job: 'cadvisor', instance: 'cadvisor:8080' }, value: [1700000000, '1'] },
          ];
        } else if (query.includes('node_cpu_seconds_total')) {
          result = [{ value: [1700000000, '12.3456'] }];
        } else if (query.includes('node_memory_MemAvailable_bytes')) {
          result = [{ value: [1700000000, '45.6789'] }];
        } else if (query.includes('node_memory_SwapFree_bytes')) {
          result = [{ value: [1700000000, '20.0000'] }];
        } else if (query.includes('node_filesystem_avail_bytes') && query.includes('/')) {
          if (query.includes('node_filesystem_size_bytes')) {
            result = [{ value: [1700000000, '65.4321'] }];
          } else {
            result = [{ value: [1700000000, '10737418240'] }];
          }
        } else if (query.includes('node_load1')) {
          result = [{ value: [1700000000, '0.45'] }];
        } else if (query.includes('node_network_receive_bytes_total')) {
          result = [{ value: [1700000000, '10240'] }];
        } else if (query.includes('node_network_transmit_bytes_total')) {
          result = [{ value: [1700000000, '20480'] }];
        } else if (query.includes('container_memory_working_set_bytes')) {
          result = [
            {
              metric: {
                name: '2ba0f5d6c4c6ae2d0ed736ba9c40b3b386bf7bb01af7d4ceea3dcd99be3e2ee0',
                image: 'docker.io/library/node:22-bookworm',
              },
              value: [1700000000, '268435456'],
            },
            {
              metric: {
                name: 'eeccdd11481b852be541992f626dc607e6164ad7b23c63ac3c4fd23b2c1fc3b9',
                image: 'docker.io/library/postgres:16',
              },
              value: [1700000000, '134217728'],
            },
          ];
        } else if (query.includes('container_cpu_usage_seconds_total')) {
          result = [
            {
              metric: {
                name: '2ba0f5d6c4c6ae2d0ed736ba9c40b3b386bf7bb01af7d4ceea3dcd99be3e2ee0',
                image: 'docker.io/library/node:22-bookworm',
              },
              value: [1700000000, '1.25'],
            },
          ];
        }

        return new Response(JSON.stringify({ status: 'success', data: { result } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const data = await getMonitoringData();

      assert.strictEqual(data.serverUp, true);
      assert.strictEqual(data.cpuPercent, 12.35);
      assert.strictEqual(data.ramPercent, 45.68);
      assert.strictEqual(data.swapPercent, 20.0);
      assert.strictEqual(data.diskPercent, 65.43);
      assert.strictEqual(data.diskFreeBytes, 10737418240);
      assert.strictEqual(data.load1, 0.45);
      assert.strictEqual(data.networkRxBps, 10240);
      assert.strictEqual(data.networkTxBps, 20480);

      // Targets
      assert.strictEqual(data.targets.prometheus, 'UP');
      assert.strictEqual(data.targets.node_exporter, 'UP');
      assert.strictEqual(data.targets.cadvisor, 'UP');

      // Containers
      assert.strictEqual(data.containers.length, 2);
      assert.strictEqual(data.containers[0].id, '2ba0f5d6c4c6');
      assert.strictEqual(data.containers[0].image, 'node:22-bookworm');
      assert.strictEqual(data.containers[0].memoryBytes, 268435456);
      assert.strictEqual(data.containers[0].cpuPercent, 1.25);
      assert.strictEqual(data.containers[0].status, 'UP');

      assert.strictEqual(data.containers[1].id, 'eeccdd11481b');
      assert.strictEqual(data.containers[1].image, 'postgres:16');
      assert.strictEqual(data.containers[1].status, 'UP');
    });
  });

  describe('getMonitoringData - Gestion des pannes et timeouts', () => {
    it('gère proprement le timeout Prometheus sans lever d exception non capturée', async () => {
      global.fetch = async () => {
        const error = new Error('The operation was aborted due to timeout');
        error.name = 'AbortError';
        throw error;
      };

      const data = await getMonitoringData();

      assert.strictEqual(data.serverUp, false);
      assert.strictEqual(data.error, 'Monitoring indisponible');
      assert.strictEqual(data.cpuPercent, null);
      assert.strictEqual(data.ramPercent, null);
      assert.strictEqual(data.targets.prometheus, 'DOWN');
      assert.strictEqual(data.targets.node_exporter, 'DOWN');
      assert.strictEqual(data.targets.cadvisor, 'DOWN');
      assert.deepStrictEqual(data.containers, []);
    });

    it('gère proprement une réponse HTTP 500 de Prometheus', async () => {
      global.fetch = async () => {
        return new Response('Internal Server Error', { status: 500 });
      };

      const data = await getMonitoringData();

      assert.strictEqual(data.serverUp, false);
      assert.strictEqual(data.error, 'Monitoring indisponible');
      assert.strictEqual(data.targets.prometheus, 'DOWN');
    });
  });

  describe('Sécurité - Fuite d URLs et secrets', () => {
    it('ne contient aucune URL Prometheus ni aucun secret dans la réponse agrégée', async () => {
      global.fetch = async () => {
        return new Response(JSON.stringify({ status: 'success', data: { result: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const data = await getMonitoringData();
      const rawString = JSON.stringify(data);

      assert.ok(!rawString.includes('prometheus:9090'), 'Aucune URL interne Prometheus');
      assert.ok(!rawString.includes('http://'), 'Aucun protocole interne');
      assert.ok(!rawString.includes('SECRET'), 'Aucun secret');
    });
  });

  describe('Protection API Route /api/admin/monitoring', () => {
    it('refuse une requête sans session administrateur avec un statut 401', async () => {
      const res = await GET();
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error, 'Accès non autorisé');
    });
  });
});
