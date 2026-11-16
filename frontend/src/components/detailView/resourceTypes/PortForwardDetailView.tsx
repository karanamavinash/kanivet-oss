import { useCallback, useEffect, useState } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import {
  ExternalLinkIcon,
  MixIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import api from '../../../services/api';
import { PortForward } from '../../../services/api/types';
import { getErrorMessage } from '../../../utils/errorMessage';
import { useStore } from '../../../store';
import PropertyGroup from '../shared/PropertyGroup';
import PropertyRow from '../../common/PropertyRow';
import { Tooltip } from '../../common/Tooltip';
import {
  localForwardHttpUrl,
  PORT_FORWARD_DETAIL_KIND,
  PORT_FORWARD_KIND_SERVICE,
  PORT_FORWARD_LIST_POLL_MS,
  PORT_FORWARD_LOCAL_HOST,
  PORT_FORWARD_PROTOCOL_HTTP,
  PORT_FORWARD_STATUS_ACTIVE,
} from '../../portforward/portForwardConstants';
import {
  displayKind,
  displayName,
  displayStatus,
  openPortForwardTarget,
} from '../../portforward/portForwardUtils';

interface PortForwardDetailViewProps {
  cluster: string;
  forward: PortForward & { portForwardId?: string };
  mode?: 'detail' | 'center';
}

const PortForwardDetailView = ({ cluster, forward: initial }: PortForwardDetailViewProps) => {
  const forwardId = initial.portForwardId || initial.id;
  const [forward, setForward] = useState<PortForward>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cluster || !forwardId) return;
    try {
      const list = await api.listPortForwards(cluster);
      const hit = list.find((p) => p.id === forwardId);
      if (hit) setForward(hit);
    } catch {
      /* keep last snapshot */
    }
  }, [cluster, forwardId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, PORT_FORWARD_LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const syncNavCount = useCallback(
    async () => {
      try {
        const list = await api.listPortForwards(cluster);
        useStore.getState().setPortForwardNavCount(cluster, list.filter((p) => p.active).length);
      } catch {
        /* ignore */
      }
    },
    [cluster],
  );

  const run = async (action: () => Promise<void>, failMsg: string, closeOnSuccess = false) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      await syncNavCount();
      if (closeOnSuccess) {
        const { activeTabs, currentTab, closeDetailTab } = useStore.getState();
        const activeId = activeTabs.find((t) => t.id === currentTab)?.state.activeDetailTab;
        if (activeId) closeDetailTab(activeId);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, failMsg));
    } finally {
      setBusy(false);
    }
  };

  const isActive = displayStatus(forward) === PORT_FORWARD_STATUS_ACTIVE;
  const remoteLabel = displayKind(forward) === PORT_FORWARD_KIND_SERVICE ? 'Service port' : 'Pod port';
  const headerUrl = localForwardHttpUrl(forward.localPort);

  return (
    <div className="resource-detail-view">
      <div className="resource-header">
        <div className="resource-header-top">
          <div className="resource-identity">
            <span className="resource-header-tile resource-header-tile--info" aria-hidden="true">
              <MixIcon />
            </span>
            <div className="resource-identity-text">
              <h2 className="resource-name">
                <span>{isActive ? `Port forward: ${headerUrl}` : displayName(forward)}</span>
              </h2>
              <div className="resource-kind-row">
                <span className="resource-kind-badge">{PORT_FORWARD_DETAIL_KIND}</span>
                <span className="resource-subtitle-sep">·</span>
                <span className="resource-namespace">{forward.namespace}</span>
                <span className="resource-subtitle-sep">·</span>
                <span className={`port-forwarding-status ${isActive ? 'is-active' : ''}`}>
                  {displayStatus(forward)}
                </span>
              </div>
            </div>
          </div>
          <div className="resource-actions-row">
            {isActive && (
              <Tooltip content="Open in browser">
                <a
                  className="tab-content-action-btn priority-low"
                  href={headerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open in browser"
                >
                  <span className="ap-action-icon"><ExternalLinkIcon /></span>
                  <span className="ap-action-label">Open</span>
                </a>
              </Tooltip>
            )}
            {isActive ? (
              <Tooltip content="Stop port forward">
                <button
                  type="button"
                  className="tab-content-action-btn priority-low"
                  disabled={busy}
                  aria-label="Stop port forward"
                  onClick={() => void run(() => api.stopPortForward(forward.id), 'Failed to stop port forward')}
                >
                  <span className="ap-action-icon"><StopIcon /></span>
                  <span className="ap-action-label">Stop</span>
                </button>
              </Tooltip>
            ) : (
              <Tooltip content="Start port forward">
                <button
                  type="button"
                  className="tab-content-action-btn priority-low"
                  disabled={busy}
                  aria-label="Start port forward"
                  onClick={() =>
                    void run(
                      () => api.startPortForward({ ...forward, cluster: forward.cluster || cluster }).then(() => {}),
                      'Failed to start port forward',
                    )
                  }
                >
                  <span className="ap-action-icon"><PlayIcon /></span>
                  <span className="ap-action-label">Start</span>
                </button>
              </Tooltip>
            )}
            <Tooltip content="Delete port forward">
              <button
                type="button"
                className="tab-content-action-btn ap-action--danger"
                disabled={busy}
                aria-label="Delete port forward"
                onClick={() => void run(() => api.removePortForward(forward.id), 'Failed to delete port forward', true)}
              >
                <span className="ap-action-icon"><TrashIcon /></span>
                <span className="ap-action-label">Delete</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {error && (
        <div className="port-forwarding-error" role="alert" style={{ margin: '8px 14px 0' }}>
          {error}
        </div>
      )}

      <ScrollArea.Root className="resource-detail-scroll">
        <ScrollArea.Viewport className="resource-detail-viewport">
          <div className="info-sections">
            <PropertyGroup title="Port forward" icon={<MixIcon />} defaultOpen>
              <PropertyRow
                label="Resource name"
                value={
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => openPortForwardTarget(cluster, forward)}
                  >
                    {displayName(forward)}
                  </button>
                }
                copyText={displayName(forward)}
              />
              <PropertyRow label="Namespace" value={forward.namespace} copyText={forward.namespace} />
              <PropertyRow label="Kind" value={displayKind(forward)} />
              <PropertyRow label={remoteLabel} value={forward.remotePort} />
              <PropertyRow
                label="Local port"
                value={
                  isActive ? (
                    <a href={headerUrl} target="_blank" rel="noopener noreferrer" className="link-button">
                      {forward.localPort}
                    </a>
                  ) : (
                    forward.localPort
                  )
                }
                copyText={String(forward.localPort)}
              />
              <PropertyRow label="Protocol" value={PORT_FORWARD_PROTOCOL_HTTP} />
              <PropertyRow label="Address" value={PORT_FORWARD_LOCAL_HOST} copyText={PORT_FORWARD_LOCAL_HOST} />
              <PropertyRow
                label="Status"
                value={
                  <span className={`port-forwarding-status ${isActive ? 'is-active' : ''}`}>
                    {displayStatus(forward)}
                  </span>
                }
              />
            </PropertyGroup>
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="scroll-area-scrollbar">
          <ScrollArea.Thumb className="scroll-area-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
};

export default PortForwardDetailView;