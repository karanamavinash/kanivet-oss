import api from '../../services/api';
import { PortForward } from '../../services/api/types';
import { useStore } from '../../store';
import {
  PORT_FORWARD_API_VERSION,
  PORT_FORWARD_DETAIL_API_VERSION,
  PORT_FORWARD_DETAIL_KIND,
  PORT_FORWARD_KIND_POD,
  PORT_FORWARD_KIND_SERVICE,
  PORT_FORWARD_RESOURCE_LIST_NAME,
  PORT_FORWARD_RESOURCE_POD,
  PORT_FORWARD_RESOURCE_SERVICE,
  PORT_FORWARD_STATUS_ACTIVE,
  PORT_FORWARD_STATUS_INACTIVE,
} from './portForwardConstants';

export const displayName = (pf: PortForward) => pf.name || pf.podName;

export const displayKind = (pf: PortForward) => (pf.kind || PORT_FORWARD_KIND_POD).toLowerCase();

export const displayStatus = (pf: PortForward) =>
  pf.active ? PORT_FORWARD_STATUS_ACTIVE : PORT_FORWARD_STATUS_INACTIVE;

export function matchesPortForwardQuery(pf: PortForward, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    displayName(pf),
    pf.namespace,
    displayKind(pf),
    pf.podName,
    String(pf.localPort),
    String(pf.remotePort),
    displayStatus(pf),
  ].join(' ').toLowerCase();
  return haystack.includes(q);
}

/** Open pod or service this forward targets in the detail panel. */
export function openPortForwardTarget(cluster: string, pf: PortForward) {
  const isService = displayKind(pf) === PORT_FORWARD_KIND_SERVICE;
  const resource = {
    name: isService ? 'services' : 'pods',
    group: '',
    version: PORT_FORWARD_API_VERSION,
    kind: isService ? PORT_FORWARD_RESOURCE_SERVICE : PORT_FORWARD_RESOURCE_POD,
    namespaced: true,
  };
  const resName = isService ? displayName(pf) : pf.podName;
  const item = {
    name: resName,
    namespace: pf.namespace,
    metadata: { name: resName, namespace: pf.namespace },
    kind: resource.kind,
    apiVersion: PORT_FORWARD_API_VERSION,
  };
  const s = useStore.getState();
  s.openDetailTab(resource, item, cluster);
  s.updateCurrentTabState({ isDetailsPanelCollapsed: false, focusArea: 'detail' });
  void s.loadDetails(cluster, resource, item);
}

/** Show this forward in the right-hand detail panel (port-forward fields only). */
export function openPortForwardDetail(cluster: string, pf: PortForward) {
  const name = displayName(pf);
  const resource = {
    name: PORT_FORWARD_RESOURCE_LIST_NAME,
    group: 'kanivet.io',
    version: 'portforward',
    kind: PORT_FORWARD_DETAIL_KIND,
    namespaced: true,
    apiVersion: PORT_FORWARD_DETAIL_API_VERSION,
  };
  const item: PortForward & {
    kind: string;
    apiVersion: string;
    portForwardId: string;
    metadata: { name: string; namespace: string };
  } = {
    ...pf,
    cluster: pf.cluster || cluster,
    kind: PORT_FORWARD_DETAIL_KIND,
    apiVersion: PORT_FORWARD_DETAIL_API_VERSION,
    portForwardId: pf.id,
    metadata: { name: `${name} · ${pf.localPort}`, namespace: pf.namespace },
  };
  const s = useStore.getState();
  s.openDetailTab(resource, item, cluster);
  s.updateCurrentTabState({ isDetailsPanelCollapsed: false, focusArea: 'detail' });
}

export function portForwardMatchesService(
  pf: PortForward,
  namespace: string,
  serviceName: string,
  port: number,
): boolean {
  if (!pf.active) return false;
  if (pf.namespace !== namespace || displayKind(pf) !== PORT_FORWARD_KIND_SERVICE) return false;
  if (displayName(pf) !== serviceName) return false;
  return (pf.servicePort ?? pf.remotePort) === port;
}

export function portForwardMatchesPod(
  pf: PortForward,
  namespace: string,
  podName: string,
  remotePort: number,
): boolean {
  if (!pf.active) return false;
  if (pf.namespace !== namespace || displayKind(pf) === PORT_FORWARD_KIND_SERVICE) return false;
  if (pf.podName !== podName) return false;
  return pf.remotePort === remotePort;
}

export function buildServicePortForwardMap(
  forwards: PortForward[],
  namespace: string,
  serviceName: string,
): Record<string, PortForward> {
  const out: Record<string, PortForward> = {};
  for (const pf of forwards) {
    const port = pf.servicePort ?? pf.remotePort;
    if (!portForwardMatchesService(pf, namespace, serviceName, port)) continue;
    out[String(port)] = pf;
  }
  return out;
}

export function buildPodPortForwardMap(
  forwards: PortForward[],
  namespace: string,
  podName: string,
  ports: Array<{ containerName: string; port: number }>,
): Record<string, PortForward> {
  const out: Record<string, PortForward> = {};
  for (const { containerName, port } of ports) {
    const hit = forwards.find((pf) => portForwardMatchesPod(pf, namespace, podName, port));
    if (hit) out[`${containerName}-${port}`] = hit;
  }
  return out;
}

export async function findActivePortForward(
  cluster: string,
  namespace: string,
  sourceName: string,
  port: number,
  kind: typeof PORT_FORWARD_KIND_POD | typeof PORT_FORWARD_KIND_SERVICE,
): Promise<PortForward | undefined> {
  const list = await api.listPortForwards(cluster);
  return list.find((pf) =>
    kind === PORT_FORWARD_KIND_SERVICE
      ? portForwardMatchesService(pf, namespace, sourceName, port)
      : portForwardMatchesPod(pf, namespace, sourceName, port),
  );
}