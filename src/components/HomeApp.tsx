"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Table, LayoutGrid, Palette, Database, Tv, Moon, Sun, Loader2, Plus, Trash2, Copy, Check, X, Users, HardDrive } from "lucide-react";
import MatrixView from "./MatrixView";
import DetectiveBoard from "./DetectiveBoard";
import {
  DANGO_STORAGE_KEYS,
  isDangoSyncStorageKey,
  readStorageSnapshot,
  touchStorageRevision,
} from "../lib/dango-storage";

import type { Question, Regular, RegularPreset, Suspect } from "@/lib/dango-types";

/** アプリ共通カスタムダイアログの型 */
interface DialogState {
  open: boolean;
  title: string;
  message: string;
  type: "info" | "confirm";
  onConfirm: () => void;
}

const DIALOG_INITIAL: DialogState = {
  open: false,
  title: "",
  message: "",
  type: "info",
  onConfirm: () => {},
};

// === カスタムSVG 団子アイコン ===
function DangoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="だんごかくれんぼ ロゴ">
      {/* 串 */}
      <line x1="14" y1="4" x2="14" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* 団子3つ（グラデーション調） */}
      <circle cx="14" cy="7" r="4.5" fill="url(#dango-top)" />
      <circle cx="14" cy="14.5" r="4.5" fill="url(#dango-mid)" />
      <circle cx="14" cy="22" r="4.5" fill="url(#dango-bot)" />
      <defs>
        <radialGradient id="dango-top" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="rgba(var(--accent-r),var(--accent-g),var(--accent-b),1)" />
          <stop offset="100%" stopColor="rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.55)" />
        </radialGradient>
        <radialGradient id="dango-mid" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(220,220,240,0.7)" />
        </radialGradient>
        <radialGradient id="dango-bot" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.85)" />
          <stop offset="100%" stopColor="rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.4)" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// === HSV / Hex カラーユーティリティ ===
const hsvToHex = (h: number, s: number, v: number): string => {
  const sFraction = s / 100;
  const vFraction = v / 100;
  const c = vFraction * sFraction;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vFraction - c;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60)   { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToHsv = (hex: string): { h: number; s: number; v: number } => {
  let clean = hex.replace("#", "");
  if (clean.length === 3) clean = clean.split("").map(c => c + c).join("");
  const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min;
  let h = 0;
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : Math.round((diff / max) * 100), v: Math.round(max * 100) };
};

export default function HomeApp() {
  const [activeTab, setActiveTab] = useState<"matrix" | "board">("matrix");
  const [accentColor, setAccentColor] = useState("#8b5cf6");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);

  // カスタムダイアログステート
  const [dialog, setDialog] = useState<DialogState>(DIALOG_INITIAL);

  // リスナープリセット
  const [presets, setPresets] = useState<RegularPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [importCodeInput, setImportCodeInput] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([
    { id: "q-1", text: "性別・特徴は？" },
    { id: "q-2", text: "好きな食べ物は？" },
    { id: "q-3", text: "最近の趣味は？" },
  ]);
  const [regulars, setRegulars] = useState<Regular[]>([]);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [hsv, setHsv] = useState({ h: 250, s: 63, v: 96 });
  const [isDraggingSb, setIsDraggingSb] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  const sbRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);
  const storageRevisionRef = useRef<string | null>(null);

  // === カスタムダイアログ表示ユーティリティ ===
  const showAlert = useCallback((title: string, message: string) => {
    setDialog({ open: true, title, message, type: "info", onConfirm: () => setDialog(DIALOG_INITIAL) });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setDialog({ open: true, title, message, type: "confirm", onConfirm: () => { onConfirm(); setDialog(DIALOG_INITIAL); } });
  }, []);

  // LocalStorage → React state（初回・他タブ・フォーカス復帰）
  const hydrateFromStorage = useCallback(() => {
    try {
      const snap = readStorageSnapshot();
      const rev = snap.revision ?? "0";
      if (rev === storageRevisionRef.current) return;
      storageRevisionRef.current = rev;

      if (snap.accent) {
        setAccentColor(snap.accent);
        setHsv(hexToHsv(snap.accent));
      }
      if (snap.questions) setQuestions(JSON.parse(snap.questions));
      if (snap.regulars) setRegulars(JSON.parse(snap.regulars));
      if (snap.suspects) setSuspects(JSON.parse(snap.suspects));
      if (snap.theme === "light" || snap.theme === "dark") setTheme(snap.theme);
      if (snap.presets) setPresets(JSON.parse(snap.presets));
    } catch (err) {
      console.error("LocalStorageのデータ復元に失敗しました:", err);
    }
  }, []);

  useEffect(() => {
    hydrateFromStorage();
    storageRevisionRef.current = readStorageSnapshot().revision ?? "0";
    setIsLoaded(true);
  }, [hydrateFromStorage]);

  // 他タブでの編集を配信タブへ反映（storage は同一タブでは発火しない）
  useEffect(() => {
    if (!isLoaded) return;

    const onStorage = (e: StorageEvent) => {
      if (!isDangoSyncStorageKey(e.key)) return;
      hydrateFromStorage();
    };

    const onFocus = () => hydrateFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [isLoaded, hydrateFromStorage]);

  // LocalStorage 自動保存
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(DANGO_STORAGE_KEYS.accent, accentColor);
      localStorage.setItem(DANGO_STORAGE_KEYS.questions, JSON.stringify(questions));
      localStorage.setItem(DANGO_STORAGE_KEYS.regulars, JSON.stringify(regulars));
      localStorage.setItem(DANGO_STORAGE_KEYS.suspects, JSON.stringify(suspects));
      localStorage.setItem(DANGO_STORAGE_KEYS.theme, theme);
      touchStorageRevision();
      storageRevisionRef.current = localStorage.getItem(DANGO_STORAGE_KEYS.revision);
    } catch (err) {
      console.error("LocalStorageへの保存に失敗しました:", err);
    }
  }, [accentColor, questions, regulars, suspects, theme, isLoaded]);

  // テーマクラス切り替え
  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.classList.toggle("light-theme", theme === "light");
  }, [theme, isLoaded]);

  // 配信モードクラス切り替え
  useEffect(() => {
    document.body.classList.toggle("broadcast-mode", isBroadcastMode);
  }, [isBroadcastMode]);

  // アクセントカラー CSS 変数更新
  useEffect(() => {
    if (!isLoaded) return;
    const cleanHex = accentColor.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    document.documentElement.style.setProperty("--accent-r", String(r));
    document.documentElement.style.setProperty("--accent-g", String(g));
    document.documentElement.style.setProperty("--accent-b", String(b));

    const rR = r / 255, gR = g / 255, bR = b / 255;
    const mx = Math.max(rR, gR, bR), mn = Math.min(rR, gR, bR);
    const l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === rR) h = (gR - bR) / d + (gR < bR ? 6 : 0);
      else if (mx === gR) h = (bR - rR) / d + 2;
      else h = (rR - gR) / d + 4;
      h = Math.round(h * 60);
    }
    const sR = Math.round(s * 100);
    const h1 = h, h2 = (h + 40) % 360, h3 = (h - 40 + 360) % 360;
    const [op1, op2, op3] = theme === "light" ? ["0.04","0.03","0.02"] : ["0.08","0.06","0.05"];
    document.documentElement.style.setProperty("--orb-color-1", `hsla(${h1},${sR}%,65%,${op1})`);
    document.documentElement.style.setProperty("--orb-color-2", `hsla(${h2},${sR}%,65%,${op2})`);
    document.documentElement.style.setProperty("--orb-color-3", `hsla(${h3},${sR}%,65%,${op3})`);
    document.documentElement.style.setProperty("--orb-h1", String(h1));
    document.documentElement.style.setProperty("--orb-h2", String(h2));
    document.documentElement.style.setProperty("--orb-h3", String(h3));
  }, [accentColor, theme, isLoaded]);

  // ポップアップ外側クリック閉じ
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isColorPickerOpen && colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node))
        setIsColorPickerOpen(false);
      if (isDataMenuOpen && dataMenuRef.current && !dataMenuRef.current.contains(e.target as Node))
        setIsDataMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isColorPickerOpen, isDataMenuOpen]);

  // === 全データリセット ===
  const handleResetAll = useCallback(() => {
    setAccentColor("#8b5cf6"); setHsv({ h: 250, s: 63, v: 96 }); setTheme("dark");
    setQuestions([
      { id: "q-1", text: "性別・特徴は？" },
      { id: "q-2", text: "好きな食べ物は？" },
      { id: "q-3", text: "最近の趣味は？" },
    ]);
    setRegulars([]); setSuspects([]);
    Object.values(DANGO_STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    storageRevisionRef.current = null;
    setIsColorPickerOpen(false); setIsDataMenuOpen(false);
  }, []);

  const handleConfirmReset = useCallback(() => {
    showConfirm("すべてのデータをリセット", "本当にすべてのデータをリセットしますか？\nこの操作は取り消せません。", handleResetAll);
  }, [showConfirm, handleResetAll]);

  // === カラーピッカー操作ハンドラ ===
  const updateFromHsv = (h: number, s: number, v: number) => {
    setHsv({ h, s, v }); setAccentColor(hsvToHex(h, s, v));
  };

  const handleSbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingSb(true); e.currentTarget.setPointerCapture(e.pointerId); handleSbDrag(e);
  };
  const handleSbDrag = (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!sbRef.current) return;
    const rect = sbRef.current.getBoundingClientRect();
    updateFromHsv(hsv.h,
      Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100),
      Math.round(Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)) * 100)
    );
  };
  const handleSbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => { if (isDraggingSb) handleSbDrag(e); };
  const handleSbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => { setIsDraggingSb(false); e.currentTarget.releasePointerCapture(e.pointerId); };

  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingHue(true); e.currentTarget.setPointerCapture(e.pointerId); handleHueDrag(e);
  };
  const handleHueDrag = (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    updateFromHsv(Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 360), hsv.s, hsv.v);
  };
  const handleHuePointerMove = (e: React.PointerEvent<HTMLDivElement>) => { if (isDraggingHue) handleHueDrag(e); };
  const handleHuePointerUp = (e: React.PointerEvent<HTMLDivElement>) => { setIsDraggingHue(false); e.currentTarget.releasePointerCapture(e.pointerId); };

  // === プリセット管理 ===
  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name) { showAlert("プリセット名が未入力", "保存するプリセットの名前を入力してください。"); return; }
    if (regulars.length === 0) { showAlert("リスナーが未登録", "保存するリスナーがまだ登録されていません。"); return; }
    const updated = [...presets.filter(p => p.name !== name), { name, regulars: regulars.map(r => ({ ...r })) }];
    setPresets(updated);
    localStorage.setItem(DANGO_STORAGE_KEYS.presets, JSON.stringify(updated));
    touchStorageRevision();
    storageRevisionRef.current = localStorage.getItem(DANGO_STORAGE_KEYS.revision);
    setNewPresetName("");
    showAlert("保存完了", `リスナープリセット「${name}」を保存しました。`);
  };

  const handleLoadPreset = (presetName: string) => {
    const target = presets.find(p => p.name === presetName);
    if (!target) return;
    showConfirm("プリセットの適用", `「${presetName}」を適用しますか？\n現在のリスナーリストは上書きされます。`, () => {
      setRegulars(target.regulars.map(r => ({ ...r }))); setIsDataMenuOpen(false);
    });
  };

  const handleDeletePreset = (presetName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm("プリセットの削除", `「${presetName}」を削除しますか？`, () => {
      const updated = presets.filter(p => p.name !== presetName);
      setPresets(updated);
      localStorage.setItem(DANGO_STORAGE_KEYS.presets, JSON.stringify(updated));
      touchStorageRevision();
      storageRevisionRef.current = localStorage.getItem(DANGO_STORAGE_KEYS.revision);
    });
  };

  // === クリップボード同期 ===
  const handleExportDataCode = () => {
    try {
      const code = btoa(unescape(encodeURIComponent(JSON.stringify({ accentColor, questions, regulars, suspects }))));
      navigator.clipboard.writeText(code).then(() => { setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); });
    } catch (err) {
      console.error("データのシリアライズに失敗しました:", err);
      showAlert("エクスポート失敗", "データコードの生成に失敗しました。");
    }
  };

  const handleImportDataCode = () => {
    const code = importCodeInput.trim();
    if (!code) { showAlert("コードが未入力", "同期コードを貼り付けてください。"); return; }
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(code))));
      if (parsed.accentColor) { setAccentColor(parsed.accentColor); setHsv(hexToHsv(parsed.accentColor)); }
      if (parsed.questions) setQuestions(parsed.questions);
      if (parsed.regulars) setRegulars(parsed.regulars);
      if (parsed.suspects) setSuspects(parsed.suspects);
      setImportCodeInput(""); setIsDataMenuOpen(false);
      showAlert("復元完了", "すべての設定とデータを正常に復元しました。");
    } catch (err) {
      console.error("コードからの復元に失敗しました:", err);
      showAlert("復元失敗", "設定コードが無効です。正しくコピーできているか確認してください。");
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#06050b]">
        <Loader2 size={36} className="text-violet-500 animate-spin mb-4" />
        <p className="text-xs text-[#a1a1aa] font-medium tracking-widest uppercase">だんごかくれんぼ 読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 relative">
      
      {/* 背景オーラオーブ（配信モード時はCSS側で透過） */}
      {!isBroadcastMode && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-10]">
          <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] rounded-full filter blur-[100px] animate-aurora-1" style={{ backgroundColor: "var(--orb-color-1)" }} />
          <div className="absolute bottom-[20%] right-[15%] w-[35vw] h-[35vw] rounded-full filter blur-[120px] animate-aurora-2" style={{ backgroundColor: "var(--orb-color-2)" }} />
          <div className="absolute top-[40%] right-[40%] w-[25vw] h-[25vw] rounded-full filter blur-[90px] animate-aurora-3" style={{ backgroundColor: "var(--orb-color-3)" }} />
        </div>
      )}

      {/* === カスタムダイアログ（グラスモーフィズム） === */}
      {dialog.open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <div className="glass-panel rounded-2xl shadow-2xl border border-white/12 w-full max-w-sm animate-popover-in overflow-hidden"
            style={{ boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.15), var(--accent-glow)` }}
          >
            {/* ダイアログヘッダー */}
            <div className="px-6 pt-6 pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "var(--accent-bg)", border: "1px solid var(--accent-border)" }}>
                  {dialog.type === "confirm"
                    ? <Trash2 size={15} style={{ color: "var(--accent-solid)" }} />
                    : <Check size={15} style={{ color: "var(--accent-solid)" }} />
                  }
                </div>
                <h3 className="text-sm font-extrabold text-[var(--foreground)] tracking-wide">{dialog.title}</h3>
              </div>
            </div>

            {/* ダイアログ本文 */}
            <div className="px-6 py-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{dialog.message}</p>
            </div>

            {/* ダイアログフッター ボタン */}
            <div className="px-6 pb-5 flex gap-3 justify-end">
              {dialog.type === "confirm" && (
                <button
                  onClick={() => setDialog(DIALOG_INITIAL)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-black/10 dark:bg-white/5 border border-white/8 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  キャンセル
                </button>
              )}
              <button
                onClick={dialog.onConfirm}
                className="px-5 py-2 rounded-xl text-xs font-extrabold text-white transition-all cursor-pointer shadow-lg"
                style={{
                  background: `linear-gradient(135deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.95), rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.75))`,
                  boxShadow: `0 4px 15px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.4)`
                }}
              >
                {dialog.type === "confirm" ? "実行する" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === ヘッダー（グラスモーフィズム） === */}
      <header className={`glass-panel px-6 py-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/10 shadow-2xl relative transition-all duration-300 ${
        isBroadcastMode ? "opacity-90 max-w-4xl mx-auto border-violet-500/20" : ""
      }`}>
        
        {/* タイトルロゴ（カスタムSVG団子） */}
        <div className="flex items-center gap-3 select-none">
          <div 
            className="w-9 h-9 rounded-xl border flex items-center justify-center shadow-lg transition-all duration-300"
            style={{ 
              borderColor: "var(--accent-border)",
              boxShadow: "var(--accent-glow)",
              backgroundColor: "var(--accent-bg)",
              color: "var(--accent-solid)"
            }}
          >
            <DangoIcon size={26} />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-sm sm:text-base font-extrabold tracking-widest bg-gradient-to-r from-[var(--foreground)] to-[var(--text-secondary)] bg-clip-text text-transparent">
              だんごかくれんぼ
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] font-bold tracking-wider uppercase">
              だんごかくれんぼ 推理キャンバス
            </p>
          </div>
        </div>

        {/* タブナビゲーション & ツールスイッチ */}
        <div className="flex items-center gap-3">
          
          {/* メイン画面切り替えタブ（配信モード中は非表示） */}
          <nav className={`flex bg-black/20 dark:bg-black/40 border border-white/5 p-1 rounded-xl shrink-0 transition-all duration-300 ${
            isBroadcastMode ? "opacity-0 pointer-events-none w-0 overflow-hidden p-0 border-none" : "opacity-100"
          }`}>
            <button
              onClick={() => setActiveTab("matrix")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                activeTab === "matrix"
                  ? "bg-white/15 dark:bg-white/10 text-[var(--foreground)] shadow-md"
                  : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              <Table size={14} style={{ color: activeTab === "matrix" ? "var(--accent-solid)" : undefined }} />
              参加者一覧
            </button>
            
            <button
              onClick={() => setActiveTab("board")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                activeTab === "board"
                  ? "bg-white/15 dark:bg-white/10 text-[var(--foreground)] shadow-md"
                  : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              <LayoutGrid size={14} style={{ color: activeTab === "board" ? "var(--accent-solid)" : undefined }} />
              推理キャンバス
            </button>
          </nav>

          {/* ストリーマーユーティリティコントロール */}
          <div className="flex items-center gap-2 relative shrink-0">
            
            {/* 配信モード切替トグル */}
            <button
              onClick={() => setIsBroadcastMode(!isBroadcastMode)}
              className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 font-extrabold text-[10px] ${
                isBroadcastMode
                  ? "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20"
                  : "bg-black/10 dark:bg-black/40 border-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/5"
              }`}
              title={isBroadcastMode ? "通常モードに戻す" : "配信画面（OBS）モードを起動"}
            >
              <Tv size={15} className={isBroadcastMode ? "animate-pulse" : ""} />
              {isBroadcastMode && <span>配信モード ON</span>}
            </button>

            {/* カラー＆テーマ調整ボタン */}
            {!isBroadcastMode && (
              <div className="relative" ref={colorPickerRef}>
                <button
                  onClick={() => { setIsColorPickerOpen(!isColorPickerOpen); setIsDataMenuOpen(false); }}
                  className={`p-2.5 rounded-xl bg-black/10 dark:bg-black/40 border border-white/5 hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all duration-200 ${
                    isColorPickerOpen ? "border-[var(--accent-border)] text-[var(--foreground)]" : ""
                  }`}
                  title="テーマ＆アクセントカラー調整"
                >
                  <Palette size={15} style={{ color: isColorPickerOpen ? "var(--accent-solid)" : undefined }} />
                </button>

                {/* カラー調整ポップアップ */}
                {isColorPickerOpen && (
                  <div className="absolute right-0 top-12 z-50 glass-panel p-4 rounded-2xl shadow-2xl border border-white/12 w-64 animate-popover-in space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-extrabold text-[var(--foreground)]">アクセントカラー調整</span>
                      <button onClick={() => setIsColorPickerOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors cursor-pointer">
                        <X size={14} />
                      </button>
                    </div>

                    {/* 彩度・明度ボード */}
                    <div 
                      ref={sbRef}
                      onPointerDown={handleSbPointerDown}
                      onPointerMove={handleSbPointerMove}
                      onPointerUp={handleSbPointerUp}
                      className="w-full h-32 rounded-lg relative overflow-hidden cursor-crosshair"
                      style={{
                        backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                        backgroundImage: `linear-gradient(to right, #fff, transparent), linear-gradient(to top, #000, transparent)`
                      }}
                    >
                      <div 
                        className="w-3.5 h-3.5 rounded-full border-2 border-white absolute shadow-md -translate-x-1/2 translate-y-1/2 pointer-events-none"
                        style={{ left: `${hsv.s}%`, bottom: `${hsv.v}%`, backgroundColor: accentColor }}
                      />
                    </div>

                    {/* 色相スライダー */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-[var(--text-secondary)] font-bold">色相 (Hue)</div>
                      <div 
                        ref={hueRef}
                        onPointerDown={handleHuePointerDown}
                        onPointerMove={handleHuePointerMove}
                        onPointerUp={handleHuePointerUp}
                        className="w-full h-3.5 rounded-full cursor-pointer relative"
                        style={{ backgroundImage: `linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)` }}
                      >
                        <div 
                          className="w-2.5 h-4 rounded bg-white border border-black/20 absolute -translate-x-1/2 top-[-2px] pointer-events-none shadow"
                          style={{ left: `${(hsv.h / 360) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* 厳選スウォッチ */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-[var(--text-secondary)] font-bold">ネオン・スウォッチ</div>
                      <div className="flex gap-2.5 justify-between">
                        {[
                          { name: "バイオレット", hex: "#8b5cf6" },
                          { name: "サイバーピンク", hex: "#f43f5e" },
                          { name: "ミント", hex: "#10b981" },
                          { name: "アクア", hex: "#06b6d4" },
                          { name: "アンバー", hex: "#f59e0b" }
                        ].map(color => (
                          <button
                            key={color.hex}
                            onClick={() => { setAccentColor(color.hex); setHsv(hexToHsv(color.hex)); }}
                            className={`w-6 h-6 rounded-full border border-white/10 shadow hover:scale-110 active:scale-95 transition-all cursor-pointer ${
                              accentColor.toLowerCase() === color.hex.toLowerCase() ? "ring-2 ring-white/60 ring-offset-2 ring-offset-[#06050b]" : ""
                            }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] border-t border-white/5 pt-2">
                      <span className="font-semibold uppercase">{accentColor.toUpperCase()}</span>
                      <button
                        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/10 dark:bg-white/5 border border-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors font-bold cursor-pointer"
                      >
                        {theme === "light" ? <Moon size={11} /> : <Sun size={11} />}
                        {theme === "light" ? "ダーク" : "ライト"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* データ＆プリセット管理ボタン */}
            {!isBroadcastMode && (
              <div className="relative" ref={dataMenuRef}>
                <button
                  onClick={() => { setIsDataMenuOpen(!isDataMenuOpen); setIsColorPickerOpen(false); }}
                  className={`p-2.5 rounded-xl bg-black/10 dark:bg-black/40 border border-white/5 hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all duration-200 ${
                    isDataMenuOpen ? "border-[var(--accent-border)] text-[var(--foreground)]" : ""
                  }`}
                  title="リスナープリセット＆データ管理"
                >
                  <Database size={15} style={{ color: isDataMenuOpen ? "var(--accent-solid)" : undefined }} />
                </button>

                {/* データ＆プリセット管理ポップアップ */}
                {isDataMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 glass-panel p-4 rounded-2xl shadow-2xl border border-white/12 w-72 animate-popover-in space-y-4 max-h-[550px] overflow-y-auto scrollbar-thin">
                    
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-extrabold text-[var(--foreground)]">リスナー・データ管理</span>
                      <button onClick={() => setIsDataMenuOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors cursor-pointer">
                        <X size={14} />
                      </button>
                    </div>

                    {/* A. リスナープリセット */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wide">
                        <Users size={11} />
                        リスナープリセット保存・適用
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="プリセット名を入力..."
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                          className="flex-1 bg-black/20 dark:bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent-border)] text-[var(--foreground)] transition-colors"
                        />
                        <button
                          onClick={handleSavePreset}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-0.5 shrink-0 text-white cursor-pointer"
                          style={{ backgroundColor: "var(--accent-solid)" }}
                        >
                          <Plus size={12} />
                          保存
                        </button>
                      </div>

                      <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin">
                        {presets.length === 0 ? (
                          <div className="text-[9px] text-[var(--text-secondary)] italic py-3 text-center bg-black/10 dark:bg-white/5 rounded-lg border border-white/5">
                            保存されたプリセットはありません
                          </div>
                        ) : (
                          presets.map(p => (
                            <div
                              key={p.name}
                              onClick={() => handleLoadPreset(p.name)}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-black/20 dark:bg-white/5 border border-white/5 hover:border-[var(--accent-border)] text-[10px] flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-all group"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent-solid)" }} />
                                <span className="font-bold text-[var(--foreground)] truncate">{p.name}</span>
                                <span className="text-[8px] text-[var(--text-secondary)] shrink-0">({p.regulars.length}名)</span>
                              </div>
                              <button
                                onClick={(e) => handleDeletePreset(p.name, e)}
                                className="p-0.5 rounded text-[var(--text-secondary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* B. コピペ同期 */}
                    <div className="space-y-2.5 border-t border-white/5 pt-3.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wide">
                        <HardDrive size={11} />
                        コピペデータ同期（2台PC移行用）
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleExportDataCode}
                          className="w-full py-2 rounded-lg bg-black/20 dark:bg-white/5 border border-white/8 hover:border-[var(--accent-border)] text-[10px] font-bold text-[var(--foreground)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          {isCopied ? "コードをコピーしました" : "すべてのデータを同期コードとしてコピー"}
                        </button>

                        <p className="text-[9px] text-[var(--text-secondary)]">
                          コードをもう片方のPCの「復元貼り付け」に入力するだけで同期が完了します。
                        </p>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="同期コードを貼り付け..."
                            value={importCodeInput}
                            onChange={(e) => setImportCodeInput(e.target.value)}
                            className="flex-1 bg-black/20 dark:bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent-border)] text-[var(--foreground)] transition-colors"
                          />
                          <button
                            onClick={handleImportDataCode}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                          >
                            復元
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* C. 一括リセット */}
                    <div className="border-t border-white/5 pt-3">
                      <button
                        onClick={handleConfirmReset}
                        className="w-full py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/18 text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        すべてのデータを初期化リセット
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* === コンテンツ描画エリア === */}
      <div className="transition-all duration-300">
        {activeTab === "matrix" && (
          <MatrixView
            suspects={suspects}
            setSuspects={setSuspects}
            regulars={regulars}
            questions={questions}
            setQuestions={setQuestions}
            isBroadcastMode={isBroadcastMode}
            showConfirm={showConfirm}
            showAlert={showAlert}
          />
        )}
        
        {activeTab === "board" && (
          <DetectiveBoard
            suspects={suspects}
            setSuspects={setSuspects}
            regulars={regulars}
            setRegulars={setRegulars}
            questions={questions}
            isBroadcastMode={isBroadcastMode}
            showConfirm={showConfirm}
            showAlert={showAlert}
          />
        )}
      </div>
      
    </div>
  );
}
