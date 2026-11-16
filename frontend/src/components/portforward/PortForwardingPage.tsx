import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import api from '../../services/api';
import { PortForward } from '../../services/api/types';
import { getErrorMessage } from '../../utils/errorMessage';
import { useStore } from '../../store';
import ResourceControlsBar from '../common/ResourceControlsBar';
import {
  localForwardHttpUrl,
  PORT_FORWARD_EMPTY_HINT,
  PORT_FORWARD_LIST_POLL_MS,
  PORT_FORWARD_DETAIL_KIND,
  PORT_FORWARD_PAGE_TITLE,
  PORT_FORWARD_STATUS_ACTIVE,
} from './portForwardConstants';
import {
  displayKind,
  displayName,
  displayStatus,
  matchesPortForwardQuery,
  openPortForwardDetail,
} from './portForwardUtils';
import PortForwardRowMenu from './PortForwardRowMenu';
import '../common/ResourceControlsBar.css';
import '../ResourceList.css';
import './PortForwarding.css';

interface Props {
  cluster: string;
}

const PortForwardingPage: React.FC<Props> = ({ cluster }) => {
  const { selectedNamespaces, activeResourceListTab, updateCurrentTabState, updateResourceListTab } = useStore(
    useShallow((s) => ({
      selectedNamespaces: s.getCurrentTabState()?.selectedNamespaces ?? [],
      activeResourceListTab: s.getCurrentTabState()?.activeResourceListTab,
      updateCurrentTabState: s.updateCurrentTabState,
      updateResourceListTab: s.updateResourceListTab,
    })),
  );
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [items, setItems] = useState<PortForward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

  const selectedForwardId = useStore(
    useShallow((s) => {
      const tab = s.activeTabs.find((t) => t.id === s.currentTab);
      const activeId = tab?.state.activeDetailTab;
      const detail = tab?.state.detailTabs.find((dt) => dt.id === activeId);
      if (detail?.item?.kind !== PORT_FORWARD_DETAIL_KIND) return null;
      return detail.item.portForwardId || detail.item.id || null;
    }),
  );

  useEffect(() => {
    if (!cluster) return;
    void api.getNamespaces(cluster).then(setNamespaces).catch(() => setNamespaces([]));
  }, [cluster]);

  const handleNamespaceChange = useCallback(
    (namespace: string) => {
      const next = namespace === 'all' ? [] : [namespace];
      updateCurrentTabState({ selectedNamespace: namespace, selectedNamespaces: next });
      if (activeResourceListTab) {
        updateResourceListTab(activeResourceListTab, { selectedNamespaces: next });
      }
    },
    [activeResourceListTab, updateCurrentTabState, updateResourceListTab],
  );

  const syncNavCount = useCallback(
    (list: PortForward[]) => {
      useStore.getState().setPortForwardNavCount(cluster, list.filter((p) => p.active).length);
    },
    [cluster],
  );

  const load = useCallback(async () => {
    if (!cluster) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.listPortForwards(cluster);
      setItems(list);
      syncNavCount(list);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not load port forwards'));
    } finally {
      setLoading(false);
    }
  }, [cluster, syncNavCount]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, PORT_FORWARD_LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const namespaceFiltered = useMemo(() => {
    if (selectedNamespaces.length === 0) return items;
    return items.filter((pf) => selectedNamespaces.includes(pf.namespace));
  }, [items, selectedNamespaces]);

  const filtered = useMemo(
    () => namespaceFiltered.filter((pf) => matchesPortForwardQuery(pf, searchQuery)),
    [namespaceFiltered, searchQuery],
  );

  const runAction = async (id: string, action: () => Promise<void>, failMsg: string) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, failMsg));
    } finally {
      setBusyId(null);
    }
  };

  const onStop = (id: string) => runAction(id, () => api.stopPortForward(id), 'Failed to stop port forward');
  const onStart = (pf: PortForward) =>
    runAction(pf.id, () => api.startPortForward({ ...pf, cluster: pf.cluster || cluster }).then(() => {}), 'Failed to start port forward');
  const onDelete = (id: string) => runAction(id, () => api.removePortForward(id), 'Failed to delete port forward');

  const handleRowActivate = useCallback(
    (pf: PortForward) => {
      openPortForwardDetail(cluster, pf);
    },
    [cluster],
  );

  const handleRowKeyDown = (e: React.KeyboardEvent, pf: PortForward) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowActivate(pf);
    }
  };

  return (
    <div className="port-forwarding-page resource-list-content">
      <div className="port-forwarding-title-row">
        <h2 className="port-forwarding-list-title">{PORT_FORWARD_PAGE_TITLE}</h2>
      </div>

      <ResourceControlsBar
        namespaces={namespaces}
        selectedNamespaces={selectedNamespaces}
        onNamespaceChange={handleNamespaceChange}
        showNamespaces
        showBulkActions={false}
        itemCount={namespaceFiltered.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredCount={filtered.length}
        totalCount={namespaceFiltered.length}
        onRefresh={() => { void load(); }}
      />

      {error && <div className="port-forwarding-error" role="alert">{error}</div>}

      <div className="resource-table-scroll-wrapper port-forwarding-table-area">
        {loading && items.length === 0 ? (
          <div className="port-forwarding-empty">Loading…</div>
        ) : items.length === 0 ? (
          <div className="port-forwarding-empty">
            <p>No port forwards for this cluster.</p>
            <p className="port-forwarding-hint">{PORT_FORWARD_EMPTY_HINT}</p>
          </div>
        ) : namespaceFiltered.length === 0 ? (
          <div className="port-forwarding-empty">No port forwards in the selected namespace.</div>
        ) : filtered.length === 0 ? (
          <div className="port-forwarding-empty">No port forwards match your search.</div>
        ) : (
          <table className="resource-table port-forwarding-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Namespace</th>
                <th className="port-forwarding-col-kind">Kind</th>
                <th>Remote port</th>
                <th>Local port</th>
                <th>Status</th>
                <th className="port-forwarding-menu-col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((pf) => {
                const isActive = displayStatus(pf) === PORT_FORWARD_STATUS_ACTIVE;
                const selected = selectedForwardId === pf.id;
                return (
                  <tr
                    key={pf.id}
                    className={[
                      'port-forwarding-row',
                      pf.active ? undefined : 'port-forwarding-row-inactive',
                      selected ? 'resource-row-selected' : undefined,
                    ].filter(Boolean).join(' ')}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selected}
                    onClick={() => handleRowActivate(pf)}
                    onKeyDown={(e) => handleRowKeyDown(e, pf)}
                  >
                    <td className="port-forwarding-name-cell" title={displayName(pf)}>
                      <span className="port-forwarding-name-text">{displayName(pf)}</span>
                    </td>
                    <td>{pf.namespace}</td>
                    <td className="port-forwarding-col-kind">{displayKind(pf)}</td>
                    <td>{pf.remotePort}</td>
                    <td
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {pf.active ? (
                        <a
                          href={localForwardHttpUrl(pf.localPort)}
                          className="port-forwarding-link"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {pf.localPort}
                        </a>
                      ) : (
                        pf.localPort
                      )}
                    </td>
                    <td>
                      <span className={`port-forwarding-status ${isActive ? 'is-active' : ''}`}>
                        {displayStatus(pf)}
                      </span>
                    </td>
                    <td
                      className="port-forwarding-menu-col"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <PortForwardRowMenu
                        active={pf.active}
                        open={menuId === pf.id}
                        busy={busyId === pf.id}
                        onToggle={() => setMenuId((cur) => (cur === pf.id ? null : pf.id))}
                        onClose={() => setMenuId(null)}
                        onStart={() => void onStart(pf)}
                        onStop={() => void onStop(pf.id)}
                        onDelete={() => void onDelete(pf.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PortForwardingPage;