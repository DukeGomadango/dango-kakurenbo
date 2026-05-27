"use client";

import React, { useLayoutEffect } from "react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  FloatingPortal,
  FloatingFocusManager,
  type Placement,
} from "@floating-ui/react";

export interface FloatingPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  placement?: Placement;
  gap?: number;
}

/**
 * overflow 祖先に切られないフローティング UI。
 * Portal + Floating UI で配置・反転・画面端シフトを行う。
 */
export function FloatingPopover({
  open,
  onOpenChange,
  reference,
  children,
  className = "",
  placement = "top-end",
  gap = 8,
}: FloatingPopoverProps) {
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement,
    middleware: [
      offset(gap),
      flip({
        padding: 12,
        fallbackPlacements: ["bottom-end", "top-start", "bottom-start", "left-start"],
      }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(120, availableHeight)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    refs.setReference(reference.current);
  }, [reference, open, refs]);

  const dismiss = useDismiss(context, { outsidePressEvent: "mousedown" });
  const role = useRole(context, { role: "listbox" });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!open) return null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className={`z-[9999] glass-panel shadow-2xl border border-white/12 animate-popover-in ${className}`}
          {...getFloatingProps()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}
