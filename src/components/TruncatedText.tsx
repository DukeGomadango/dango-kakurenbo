"use client";

import React from "react";

interface TruncatedTextProps {
  text: string;
  className?: string;
  /** 配信モードなど、省略せず複数行で表示する */
  multiline?: boolean;
  as?: "span" | "p";
}

/**
 * 狭いレイアウト向けテキスト。省略時は title で全文を提示する。
 */
export function TruncatedText({
  text,
  className = "",
  multiline = false,
  as: Tag = "span",
}: TruncatedTextProps) {
  const display = text || "（未入力）";
  return (
    <Tag
      className={`min-w-0 ${multiline ? "line-clamp-2 break-words" : "truncate"} ${className}`}
      title={display}
    >
      {display}
    </Tag>
  );
}
