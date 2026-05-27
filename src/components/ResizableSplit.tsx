"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/** フレックス上の実幅（当たり判定用） */
const HANDLE_WIDTH_PX = 14;

export interface ResizableSplitProps {
  /** localStorage に保存するキー（画面ごとに別キー） */
  storageKey: string;
  /** 左ペインの初期幅（コンテナ幅に対する %） */
  defaultLeftPercent: number;
  /** 左ペイン最小幅（px） */
  minLeftPx?: number;
  /** 左ペイン最大幅（コンテナ幅に対する %） */
  maxLeftPercent?: number;
  /** 右ペイン最小幅（px） */
  minRightPx?: number;
  /** true のとき固定比率（配信モード等） */
  disabled?: boolean;
  className?: string;
  left: React.ReactNode;
  right: React.ReactNode;
  /** 左ペインの実幅が変わったとき（デッキ列数連動など） */
  onLeftWidthChange?: (widthPx: number) => void;
}

function clampLeftPercent(
  percent: number,
  containerWidth: number,
  minLeftPx: number,
  maxLeftPercent: number,
  minRightPx: number
): number {
  if (containerWidth <= 0) return percent;
  const minP = (minLeftPx / containerWidth) * 100;
  const maxP = Math.min(maxLeftPercent, ((containerWidth - minRightPx) / containerWidth) * 100);
  return Math.min(maxP, Math.max(minP, percent));
}

function readStoredPercent(storageKey: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 5 && n < 95) return n;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function ResizableSplit({
  storageKey,
  defaultLeftPercent,
  minLeftPx = 240,
  maxLeftPercent = 48,
  minRightPx = 320,
  disabled = false,
  className = "",
  left,
  right,
  onLeftWidthChange,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const leftPercentRef = useRef(leftPercent);
  leftPercentRef.current = leftPercent;
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startPercent: number } | null>(null);

  useEffect(() => {
    setLeftPercent(readStoredPercent(storageKey, defaultLeftPercent));
  }, [storageKey, defaultLeftPercent]);

  useEffect(() => {
    if (!onLeftWidthChange || !leftPaneRef.current) return;
    const el = leftPaneRef.current;
    const notify = () => onLeftWidthChange(el.offsetWidth);
    notify();
    const ro = new ResizeObserver(notify);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onLeftWidthChange, leftPercent, disabled]);

  const applyPercentFromPointer = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container || !dragRef.current) return;
      const rect = container.getBoundingClientRect();
      const deltaPx = clientX - dragRef.current.startX;
      const deltaPercent = (deltaPx / rect.width) * 100;
      const next = clampLeftPercent(
        dragRef.current.startPercent + deltaPercent,
        rect.width,
        minLeftPx,
        maxLeftPercent,
        minRightPx
      );
      setLeftPercent(next);
    },
    [minLeftPx, maxLeftPercent, minRightPx]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try {
      localStorage.setItem(storageKey, String(leftPercentRef.current));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => applyPercentFromPointer(e.clientX);
    const onUp = () => endDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging, applyPercentFromPointer, endDrag]);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startPercent: leftPercent };
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const effectivePercent = disabled ? defaultLeftPercent : leftPercent;

  return (
    <>
      {/* モバイル: 縦積み（リサイズなし） */}
      <div className={`flex flex-col gap-6 md:hidden ${className}`}>
        <div className="min-h-0 flex flex-col">{left}</div>
        <div className="min-h-0 flex flex-col">{right}</div>
      </div>

      {/* デスクトップ: 横スプリット */}
      <div
        ref={containerRef}
        className={`hidden md:flex min-h-0 w-full ${disabled ? "gap-6" : ""} ${isDragging ? "select-none" : ""} ${className}`}
      >
        <div
          ref={leftPaneRef}
          className="relative z-0 min-h-0 min-w-0 flex flex-col shrink-0 overflow-hidden"
          style={{ width: `${effectivePercent}%` }}
        >
          {left}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="ペイン幅を調整"
          aria-valuenow={Math.round(effectivePercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={onHandlePointerDown}
          style={disabled ? undefined : { width: HANDLE_WIDTH_PX, flexShrink: 0 }}
          className={
            disabled
              ? "w-0 shrink-0 pointer-events-none"
              : "group relative z-50 shrink-0 flex items-center justify-center touch-none cursor-col-resize"
          }
        >
          {!disabled && (
            <div
              className={`w-1 rounded-full transition-all duration-150 pointer-events-none ${
                isDragging
                  ? "h-full bg-[var(--accent-solid)] opacity-90"
                  : "h-12 bg-white/20 group-hover:h-20 group-hover:bg-white/40"
              }`}
              aria-hidden
            />
          )}
        </div>

        <div className="relative z-0 min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">{right}</div>
      </div>
    </>
  );
}

/** 推理キャンバス・デッキ2列化の目安幅 */
export const DECK_TWO_COLUMN_MIN_PX = 340;

export function deckColumnCount(paneWidthPx: number, isBroadcastMode: boolean): 1 | 2 {
  if (isBroadcastMode) return 1;
  if (paneWidthPx <= 0) return 1;
  return paneWidthPx >= DECK_TWO_COLUMN_MIN_PX ? 2 : 1;
}
