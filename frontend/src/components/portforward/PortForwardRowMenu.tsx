import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DotsHorizontalIcon, PlayIcon, StopIcon, TrashIcon } from '@radix-ui/react-icons';
import '../common/BulkActionsDropdown.css';
import './PortForwardRowMenu.css';

interface Props {
  active: boolean;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onClose: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}

const PortForwardRowMenu: React.FC<Props> = ({
  active,
  open,
  busy,
  onToggle,
  onClose,
  onStart,
  onStop,
  onDelete,
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ right: number; top: number } | null>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const r = triggerRef.current.getBoundingClientRect();
    const menuWidth = 160;
    const right = Math.min(window.innerWidth - r.right, window.innerWidth - menuWidth - 8);
    setPos({ right, top: r.bottom + 4 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const pick = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div className="port-forward-row-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`ap-icon-btn ap-icon-btn--sm port-forward-row-menu-btn${open ? ' is-active' : ''}`}
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <DotsHorizontalIcon />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="ap-menu bulk-actions-menu port-forward-row-menu-popover"
          role="menu"
          style={{ position: 'fixed', right: pos.right, top: pos.top, left: 'auto' }}
        >
          {active ? (
            <button
              type="button"
              className="bulk-action-item port-forward-row-action"
              role="menuitem"
              disabled={busy}
              onClick={() => pick(onStop)}
            >
              <StopIcon className="bulk-action-icon" aria-hidden="true" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="bulk-action-item port-forward-row-action"
              role="menuitem"
              disabled={busy}
              onClick={() => pick(onStart)}
            >
              <PlayIcon className="bulk-action-icon" aria-hidden="true" />
              Start
            </button>
          )}
          <div className="ap-menu-sep" role="separator" />
          <button
            type="button"
            className="ap-menu-item is-destructive port-forward-row-action"
            role="menuitem"
            disabled={busy}
            onClick={() => pick(onDelete)}
          >
            <TrashIcon className="bulk-action-icon" aria-hidden="true" />
            Delete
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default PortForwardRowMenu;