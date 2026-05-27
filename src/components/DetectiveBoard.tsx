"use client";

import React, { useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Link2, Sparkles, UserX, UserCheck, Search, X, GripVertical, Plus, ChevronDown, ChevronUp, MessageSquare, User, Zap, Trash2, CheckSquare, Square } from "lucide-react";
import {
  applyBulkRegularDelete,
  applyRegularDelete,
  buildBulkRegularDeleteMessage,
  buildRegularDeleteMessage,
  countBulkRegularDeleteImpact,
  countRegularDeleteImpact,
} from "../lib/dango-delete";
import type { Question, Regular, Suspect } from "@/lib/dango-types";
import { FloatingPopover } from "./FloatingPopover";
import { TruncatedText } from "./TruncatedText";
import { ResizableSplit, deckColumnCount } from "./ResizableSplit";
import {
  DANGO_STORAGE_KEYS,
  SPLIT_BOARD_DEFAULT_PERCENT,
  SPLIT_BROADCAST_FIXED_PERCENT,
} from "../lib/dango-storage";

interface DetectiveBoardProps {
  suspects: Suspect[];
  setSuspects: (s: Suspect[]) => void;
  regulars: Regular[];
  setRegulars: (r: Regular[]) => void;
  questions: Question[];
  isBroadcastMode: boolean;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showAlert: (title: string, message: string) => void;
}

export default function DetectiveBoard({
  suspects,
  setSuspects,
  regulars,
  setRegulars,
  questions,
  isBroadcastMode,
  showConfirm,
  showAlert,
}: DetectiveBoardProps) {
  // 検索フィルター用
  const [suspectQuery, setSuspectQuery] = useState("");
  const [regularQuery, setRegularQuery] = useState("");

  // インラインリスナー登録用ステート
  const [newRegularName, setNewRegularName] = useState("");
  const [showAddRegularInput, setShowAddRegularInput] = useState(false);
  const [regularInputMode, setRegularInputMode] = useState<"single" | "bulk">("single");
  const [bulkInput, setBulkInput] = useState("");

  // リスナー一括削除（選択モード）
  const [regularSelectMode, setRegularSelectMode] = useState(false);
  const [selectedRegularIds, setSelectedRegularIds] = useState<Set<string>>(() => new Set());

  // ドラッグ＆ドロップ用ステート
  const [draggingSuspectId, setDraggingSuspectId] = useState<string | null>(null);
  const [dragOverRegularId, setDragOverRegularId] = useState<string | null>(null);

  // 手動割り当てポップオーバー（Portal 配置）
  const [activeAssignPopoverSuspectId, setActiveAssignPopoverSuspectId] = useState<string | null>(null);
  const assignAnchorRef = useRef<HTMLButtonElement>(null);

  // 参加者カード個別展開用ステート
  const [expandedSuspectId, setExpandedSuspectId] = useState<string | null>(null);

  // 左デッキペイン幅（2列グリッド連動）
  const [deckPaneWidth, setDeckPaneWidth] = useState(0);
  const deckCols = deckColumnCount(deckPaneWidth, isBroadcastMode);

  // === Drag and Drop ハンドラ ===
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, suspectId: string) => {
    if (isBroadcastMode) return; // 配信モード中はドラッグロック
    setDraggingSuspectId(suspectId);
    e.dataTransfer.setData("text/plain", suspectId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingSuspectId(null);
    setDragOverRegularId(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, regularId: string) => {
    if (isBroadcastMode) return; // 配信モード中はドラッグロック
    e.preventDefault();
    setDragOverRegularId(regularId);
  };

  const handleDragLeave = () => {
    setDragOverRegularId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, regularName: string) => {
    if (isBroadcastMode) return; // 配信モード中はドラッグロック
    e.preventDefault();
    const suspectId = e.dataTransfer.getData("text/plain") || draggingSuspectId;
    if (!suspectId) return;

    toggleLink(suspectId, regularName);

    setDraggingSuspectId(null);
    setDragOverRegularId(null);
  };

  // 本名予想リンクの切り替えロジック
  const toggleLink = (suspectId: string, regularName: string) => {
    setSuspects(
      suspects.map(s => {
        if (s.id === suspectId) {
          const currentGuesses = s.realNameGuesses || [];
          const exists = currentGuesses.includes(regularName);
          const nextGuesses = exists
            ? currentGuesses.filter(g => g !== regularName)
            : [...currentGuesses, regularName];
          return { ...s, realNameGuesses: nextGuesses };
        }
        return s;
      })
    );
  };

  // 本命当て（解決）ステータスのトグル
  const handleToggleSolved = (suspectId: string, isSolved: boolean) => {
    setSuspects(
      suspects.map(s => (s.id === suspectId ? { ...s, isSolved } : s))
    );
  };

  // 1人ずつインラインリスナー登録のサブミット処理
  const handleAddRegularInline = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newRegularName.trim();
    if (!trimmed) return;
    if (regulars.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
      showAlert("重複エラー", "その名前のリスナーはすでに登録されています。");
      return;
    }

    // 黄金比ベースの分散色相分配パステルカラー自動割り当て
    const hue = Math.round(((regulars.length + 1) * 137.5) % 360);
    const pastelColor = `hsl(${hue}, 85%, 72%)`;

    const newRegular: Regular = {
      id: `regular-${Date.now()}`,
      name: trimmed,
      color: pastelColor,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
    };

    setRegulars([...regulars, newRegular]);
    setNewRegularName("");
    setShowAddRegularInput(false);
  };

  // スマート自動抽出パーサーロジック
  const parseBulkNames = (text: string): string[] => {
    // 改行、カンマ、タブ、縦棒、スラッシュ、スペースで分割
    const tokens = text.split(/[\n,\t|/ ]+/);
    const seen = new Set<string>();
    const parsed: string[] = [];

    for (const tok of tokens) {
      let clean = tok.trim();
      // 先頭の @, -, *, • などの記号や飾りをトリム除去
      clean = clean.replace(/^[@\-*•#]+/g, "").trim();
      
      if (clean.length > 0) {
        const lower = clean.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          parsed.push(clean);
        }
      }
    }
    return parsed;
  };

  const parsedBulkNames = parseBulkNames(bulkInput);

  // スマート一括登録のアクション
  const handleAddBulkRegulars = () => {
    if (parsedBulkNames.length === 0) return;

    const newRegularsToAdd: Regular[] = [];

    parsedBulkNames.forEach((name, index) => {
      // 既存の名前と重複していないか確認
      const isAlreadyRegistered = regulars.some(r => r.name.toLowerCase() === name.toLowerCase());
      const isAlreadyInAddition = newRegularsToAdd.some(r => r.name.toLowerCase() === name.toLowerCase());
      
      if (!isAlreadyRegistered && !isAlreadyInAddition) {
        // 色相環を均等に分散した美しいパステルカラーを自動アサイン
        const count = regulars.length + newRegularsToAdd.length;
        const hue = Math.round((count * 137.5) % 360);
        const pastelColor = `hsl(${hue}, 85%, 72%)`;

        newRegularsToAdd.push({
          id: `regular-${Date.now()}-${index}`,
          name,
          color: pastelColor,
          x: 20 + Math.random() * 60,
          y: 20 + Math.random() * 60,
        });
      }
    });

    if (newRegularsToAdd.length > 0) {
      setRegulars([...regulars, ...newRegularsToAdd]);
    }
    
    setBulkInput("");
    setShowAddRegularInput(false);
  };

  const executeDeleteRegular = (regularId: string, regularName: string) => {
    const next = applyRegularDelete(regulars, regularId, regularName, suspects);
    setRegulars(next.regulars);
    setSuspects(next.suspects);
  };

  const handleDeleteRegular = (regular: Regular, e: React.MouseEvent) => {
    e.stopPropagation();
    const impact = countRegularDeleteImpact(suspects, regular.name);
    showConfirm(
      "リスナーの削除",
      buildRegularDeleteMessage(regular.name, impact),
      () => executeDeleteRegular(regular.id, regular.name)
    );
  };

  const exitRegularSelectMode = () => {
    setRegularSelectMode(false);
    setSelectedRegularIds(new Set());
  };

  const toggleRegularSelection = (regularId: string) => {
    setSelectedRegularIds(prev => {
      const next = new Set(prev);
      if (next.has(regularId)) next.delete(regularId);
      else next.add(regularId);
      return next;
    });
  };

  // リストのフィルタリング
  const unsolvedSuspects = suspects.filter(s => !s.isSolved);
  const filteredSuspects = unsolvedSuspects.filter(s =>
    (s.fakeName || "").toLowerCase().includes(suspectQuery.toLowerCase())
  );

  const filteredRegulars = regulars.filter(r =>
    r.name.toLowerCase().includes(regularQuery.toLowerCase())
  );

  const selectAllFilteredRegulars = () => {
    setSelectedRegularIds(new Set(filteredRegulars.map(r => r.id)));
  };

  const handleBulkDeleteRegulars = () => {
    const ids = [...selectedRegularIds];
    if (ids.length === 0) {
      showAlert("未選択", "削除するリスナーを選択してください。");
      return;
    }
    const names = regulars.filter(r => ids.includes(r.id)).map(r => r.name);
    const impact = countBulkRegularDeleteImpact(suspects, names);
    showConfirm(
      "リスナーの一括削除",
      buildBulkRegularDeleteMessage(ids.length, impact),
      () => {
        const next = applyBulkRegularDelete(regulars, ids, suspects);
        setRegulars(next.regulars);
        setSuspects(next.suspects);
        exitRegularSelectMode();
      }
    );
  };

  return (
    <div className="space-y-4">
      
      {/* === スプリットビュー コントロールヘッダー（配信モード時は完全非表示） === */}
      {!isBroadcastMode && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/8 backdrop-blur-md px-6 py-4 rounded-2xl">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold tracking-wide text-[var(--foreground)]">かくれんぼ・推理カード</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              【操作】左の参加者をドラッグし、右のリスナーの「リスナーポケット」に投げ入れます。クリックまたは「＋」ボタンからの手動追加にも対応しています。
            </p>
          </div>
        </div>
      )}

      {/* === ドラッグ＆ドロップ 2コラムスプリット（リサイズ可） === */}
      <ResizableSplit
        storageKey={DANGO_STORAGE_KEYS.splitBoard}
        defaultLeftPercent={isBroadcastMode ? SPLIT_BROADCAST_FIXED_PERCENT : SPLIT_BOARD_DEFAULT_PERCENT}
        disabled={isBroadcastMode}
        onLeftWidthChange={setDeckPaneWidth}
        className={`relative rounded-2xl transition-all duration-300 ${
          isBroadcastMode ? "h-[calc(100vh-120px)] min-h-[550px]" : "h-[calc(100vh-210px)] min-h-[580px]"
        }`}
        left={
        <div className={`h-full glass-panel rounded-2xl p-4 overflow-hidden border border-white/10 z-0 flex flex-col transition-all duration-300 ${
          isBroadcastMode ? "border-red-500/10 shadow-[inset_0_0_15px_rgba(239,68,68,0.02)]" : ""
        }`}>
          
          <div className="space-y-3 pb-3 border-b border-white/5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                  <UserX size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[var(--foreground)] tracking-wider">本命未決の参加者デッキ</h3>
                  <p className="text-[10px] text-[var(--text-secondary)]">残り参加者: {unsolvedSuspects.length}人</p>
                </div>
              </div>
            </div>
            
            {/* 参加者クイック検索（配信モード時は隠す） */}
            {!isBroadcastMode && (
              <div className="relative animate-fadeIn">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="参加者をリアルタイム検索..."
                  value={suspectQuery}
                  onChange={(e) => setSuspectQuery(e.target.value)}
                  className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs outline-none focus:border-violet-500 text-[var(--foreground)]"
                />
                {suspectQuery && (
                  <button
                    onClick={() => setSuspectQuery("")}
                    className="absolute right-2 top-2 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* デッキスクロールプール */}
          <div className="flex-1 overflow-y-auto mt-3 pr-1 scrollbar-thin">
            {filteredSuspects.length === 0 ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center text-[var(--text-secondary)] text-xs py-16">
                <Sparkles size={20} className="mb-2 text-violet-400 animate-pulse" />
                デッキは空です！<br />
                全員の本命当てが完了しました
              </div>
            ) : (
              <div className={`grid gap-2.5 pb-4 ${deckCols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {filteredSuspects.map(suspect => {
                  const suspectGuesses = suspect.realNameGuesses || [];
                  const hasGuesses = suspectGuesses.length > 0;
                  
                  const totalQ = questions.length;
                  const answeredQ = questions.filter(q => suspect.answers && suspect.answers[q.id]?.trim()).length;

                  const isExpanded = expandedSuspectId === suspect.id;

                  return (
                    <div
                      key={suspect.id}
                      draggable={!isBroadcastMode} // 配信モード時はドラッグ禁止
                      onDragStart={(e) => handleDragStart(e, suspect.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setExpandedSuspectId(isExpanded ? null : suspect.id)}
                      className={`w-full rounded-xl glass-card border border-white/5 p-3 flex flex-col gap-2.5 transition-all duration-200 select-none relative ${
                        isBroadcastMode 
                          ? "cursor-pointer hover:bg-white/[0.02]" 
                          : "cursor-grab active:cursor-grabbing hover:bg-white/[0.04]"
                      } ${
                        draggingSuspectId === suspect.id ? "opacity-30 border-dashed border-violet-500" : ""
                      }`}
                    >
                      {/* カード上部：ドラッグハンドル、名前、展開 chevron */}
                      <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-white/5">
                        <div className="flex items-start gap-1.5 min-w-0 flex-1">
                          {!isBroadcastMode && (
                            <GripVertical size={13} className="text-[var(--text-secondary)] cursor-grab shrink-0 mt-0.5" />
                          )}
                          <span className={`flex items-start gap-1 min-w-0 flex-1 ${
                            isBroadcastMode ? "broadcast-enlarge-text broadcast-suspect-name text-red-400" : "text-xs font-semibold text-[var(--foreground)]"
                          }`}>
                            <User size={11} className="shrink-0 opacity-60 mt-0.5" />
                            <TruncatedText
                              text={suspect.fakeName}
                              multiline={isBroadcastMode}
                            />
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-black/20 dark:bg-white/5 text-[var(--text-secondary)] flex items-center gap-0.5">
                            <MessageSquare size={9} />
                            {answeredQ}/{totalQ}
                          </span>
                          <div className="text-[var(--text-secondary)] shrink-0">
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </div>
                        </div>
                      </div>

                      {/* カード中部：回答スニペット または 全質問回答リスト */}
                      {isExpanded ? (
                        <div className="flex flex-col gap-1.5 text-[9px] border-t border-white/5 pt-2 mt-0.5 opacity-90 animate-fadeIn">
                          {questions.map((q, idx) => {
                            const ans = (suspect.answers && suspect.answers[q.id]) || "";
                            return (
                              <div key={q.id} className="flex flex-col gap-0.5 bg-black/10 dark:bg-white/5 p-1.5 rounded border border-white/5">
                                <span className={`text-[var(--text-secondary)] font-semibold truncate ${
                                  isBroadcastMode ? "broadcast-enlarge-sub" : ""
                                }`}>Q{idx + 1}: {q.text}</span>
                                <span className={`text-[var(--foreground)] truncate ${
                                  isBroadcastMode ? "broadcast-enlarge-text" : "font-medium"
                                }`}>{ans || "（未回答）"}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 text-[9px] opacity-85">
                          {questions.slice(0, 2).map(q => {
                            const ans = (suspect.answers && suspect.answers[q.id]) || "";
                            return (
                              <div key={q.id} className="flex gap-1.5 truncate">
                                <span className={`text-[var(--text-secondary)] font-semibold shrink-0 ${
                                  isBroadcastMode ? "broadcast-enlarge-sub" : ""
                                }`}>{q.text}:</span>
                                <span className={`text-[var(--foreground)] font-medium truncate ${
                                  isBroadcastMode ? "broadcast-enlarge-text" : ""
                                }`}>{ans || "（未回答）"}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* カード下部：現予想リスト ＆ 手動割り当てボタン */}
                      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-white/5 text-[9px]">
                        <div className="flex items-center gap-1 text-[var(--text-secondary)] truncate">
                          <Link2 size={10} className="shrink-0" />
                          <span
                            className={`truncate ${isBroadcastMode ? "broadcast-enlarge-sub text-violet-400" : ""}`}
                            title={hasGuesses ? suspectGuesses.join(", ") : "未予想"}
                          >
                            予想: {hasGuesses ? suspectGuesses.join(", ") : "未予想"}
                          </span>
                        </div>

                        {/* 手動割り当てボタン（配信モード時は完全に隠す） */}
                        {!isBroadcastMode && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                assignAnchorRef.current = e.currentTarget;
                                setActiveAssignPopoverSuspectId(
                                  activeAssignPopoverSuspectId === suspect.id ? null : suspect.id
                                );
                              }}
                              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors shrink-0"
                              title="リスナーのリスナーポケットに割り当てる"
                              aria-expanded={activeAssignPopoverSuspectId === suspect.id}
                              aria-haspopup="listbox"
                            >
                              <Plus size={11} />
                            </button>

                            <FloatingPopover
                              open={activeAssignPopoverSuspectId === suspect.id}
                              onOpenChange={(open) => {
                                if (!open) setActiveAssignPopoverSuspectId(null);
                              }}
                              reference={assignAnchorRef}
                              className="p-2 w-52 space-y-1.5 overflow-y-auto scrollbar-thin"
                              placement="top-end"
                            >
                              <div className="text-[8px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                                ポケットを選択:
                              </div>
                              <div className="space-y-0.5">
                                {regulars.map(r => {
                                  const isLinked = suspectGuesses.includes(r.name);
                                  return (
                                    <button
                                      key={r.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleLink(suspect.id, r.name);
                                        setActiveAssignPopoverSuspectId(null);
                                      }}
                                      className="w-full text-left px-1.5 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[9px] flex items-center gap-1.5 text-[var(--foreground)]"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                      <TruncatedText text={r.name} className="flex-1" />
                                      {isLinked && <span className="ml-auto text-emerald-500 shrink-0">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </FloatingPopover>
                          </>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        }
        right={
        <div className={`h-full glass-panel rounded-2xl p-4 overflow-hidden border border-white/10 z-0 flex flex-col transition-all duration-300 ${
          isBroadcastMode ? "border-emerald-500/10 shadow-[inset_0_0_15px_rgba(16,185,129,0.02)]" : ""
        }`}>
          
          {/* リスナーヘッダーコントロール */}
          <div className="space-y-3 pb-3 border-b border-white/5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserCheck size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[var(--foreground)] tracking-wide">リスナー一覧</h3>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    リスナー登録者数: {regulars.length}人 {!isBroadcastMode && "(参加者をここにドラッグ＆ドロップ)"}
                  </p>
                </div>
              </div>

              {/* 登録・一括削除（配信モード時は隠す） */}
              {!isBroadcastMode && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (regularSelectMode) exitRegularSelectMode();
                      else {
                        setShowAddRegularInput(false);
                        setRegularSelectMode(true);
                      }
                    }}
                    disabled={regulars.length === 0 && !regularSelectMode}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                      regularSelectMode
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-black/10 dark:bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/[0.05]"
                    }`}
                  >
                    <Trash2 size={11} />
                    {regularSelectMode ? "選択終了" : "選択して削除"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exitRegularSelectMode();
                      setShowAddRegularInput(!showAddRegularInput);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                      showAddRegularInput
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold"
                        : "bg-black/10 dark:bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/[0.05]"
                    }`}
                  >
                    <Plus size={11} />
                    登録・一括追加
                  </button>
                </div>
              )}
            </div>

            {/* 一括削除ツールバー */}
            {regularSelectMode && !isBroadcastMode && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-red-500/[0.04] border border-red-500/15 animate-fadeIn">
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                  {selectedRegularIds.size}人選択中
                  {regularQuery && `（検索結果 ${filteredRegulars.length}人）`}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={selectAllFilteredRegulars}
                    disabled={filteredRegulars.length === 0}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold border border-white/10 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/[0.05] disabled:opacity-40"
                  >
                    {regularQuery ? "検索結果を全選択" : "すべて選択"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRegularIds(new Set())}
                    disabled={selectedRegularIds.size === 0}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold border border-white/10 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/[0.05] disabled:opacity-40"
                  >
                    選択解除
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDeleteRegulars}
                    disabled={selectedRegularIds.size === 0}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {selectedRegularIds.size > 0 ? `${selectedRegularIds.size}人を削除` : "削除"}
                  </button>
                </div>
              </div>
            )}

            {/* インラインリスナー登録 ＆ スマート一括登録フォーム */}
            {showAddRegularInput && !isBroadcastMode && (
              <div className="p-3 rounded-xl bg-black/10 dark:bg-white/5 border border-white/5 animate-fadeIn space-y-3">
                {/* モード切り替えタブ */}
                <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5 w-fit">
                  <button
                    type="button"
                    onClick={() => setRegularInputMode("single")}
                    className={`px-3 py-1 rounded-md text-[10px] font-extrabold transition-all ${
                      regularInputMode === "single"
                        ? "bg-white/10 text-[var(--foreground)] shadow"
                        : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    1人ずつ登録
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegularInputMode("bulk")}
                    className={`px-3 py-1 rounded-md text-[10px] font-extrabold transition-all ${
                      regularInputMode === "bulk"
                        ? "bg-white/10 text-[var(--foreground)] shadow"
                        : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Zap size={12} />
                    スマート一括インポート
                  </button>
                </div>

                {/* A. 1人ずつ登録モード */}
                {regularInputMode === "single" && (
                  <form onSubmit={handleAddRegularInline} className="flex gap-2 animate-fadeIn">
                    <input
                      type="text"
                      placeholder="新しいリスナーの名前を入力..."
                      value={newRegularName}
                      onChange={(e) => setNewRegularName(e.target.value)}
                      className="flex-1 bg-black/20 dark:bg-black/40 border border-white/5 rounded px-2.5 py-1 text-xs outline-none text-[var(--foreground)] font-medium"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-[var(--accent-solid)] hover:opacity-90 text-white text-[10px] font-bold transition-all shrink-0"
                    >
                      登録
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddRegularInput(false); setNewRegularName(""); }}
                      className="p-1 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </form>
                )}

                {/* B. スマート一括インポートモード */}
                {regularInputMode === "bulk" && (
                  <div className="space-y-3 animate-fadeIn">
                    <textarea
                      placeholder="チャットログ、Discordメンション、スプレッドシート等をそのままここに貼り付けてください（自動で整形して登録します）..."
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      className="w-full h-24 bg-black/25 dark:bg-black/40 border border-white/8 rounded-lg p-2.5 text-xs outline-none focus:border-violet-500 text-[var(--foreground)] resize-none"
                    />

                    {/* ライブバッジプレビュー */}
                    {parsedBulkNames.length > 0 && (
                      <div className="space-y-1.5 bg-black/10 dark:bg-white/5 p-2 rounded-lg border border-white/5">
                        <div className="text-[9px] font-extrabold text-[var(--text-secondary)] flex items-center justify-between">
                          <span>▼ 抽出されたリスナー候補 ({parsedBulkNames.length}名)</span>
                          <span className="text-[8px] text-emerald-400 font-bold">※クリックで除外</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-thin py-0.5">
                          {parsedBulkNames.map((name) => (
                            <div
                              key={name}
                              onClick={() => {
                                // 貼り付けデータから対象名を除去
                                const nextList = parsedBulkNames.filter(n => n !== name);
                                setBulkInput(nextList.join("\n"));
                              }}
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[9px] text-[var(--accent-solid)] font-bold cursor-pointer hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
                            >
                              <span className="flex items-center gap-1">
                                <User size={8} className="shrink-0 opacity-70" />
                                {name}
                              </span>
                              <X size={7} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <p className="text-[9px] text-[var(--text-secondary)] font-medium">
                        ※カンマやスペース、改行、@マークなどを自動パースし、被りを除外します。
                      </p>
                      
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setBulkInput(""); setShowAddRegularInput(false); }}
                          className="px-2.5 py-1 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={handleAddBulkRegulars}
                          disabled={parsedBulkNames.length === 0}
                          className="px-3.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-extrabold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                        >
                          {parsedBulkNames.length}人を一括登録
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* リスナークイック検索（配信モード時は隠す） */}
            {!isBroadcastMode && (
              <div className="relative animate-fadeIn">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="リスナーをリアルタイム検索..."
                  value={regularQuery}
                  onChange={(e) => setRegularQuery(e.target.value)}
                  className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs outline-none focus:border-violet-500 text-[var(--foreground)]"
                />
                {regularQuery && (
                  <button
                    onClick={() => setRegularQuery("")}
                    className="absolute right-2 top-2 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ポケットスクロールグリッド */}
          <div className="flex-1 overflow-y-auto space-y-4 mt-3 pr-1 scrollbar-thin">
            {filteredRegulars.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-secondary)] text-xs py-16">
                <AlertCircle size={20} className="mb-2 text-[#71717a] opacity-50" />
                リスナーが見つかりません。
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-4">
                {filteredRegulars.map(regular => {
                  // このリスナーポケットに格納されている「当て完了（解決）」された参加者たち
                  const dockedSuspects = suspects.filter(s => s.isSolved && (s.realNameGuesses || []).includes(regular.name));
                  // このリスナーポケットに現在「予想リンク」されている本命未決の参加者たち
                  const linkedSuspects = suspects.filter(s => !s.isSolved && (s.realNameGuesses || []).includes(regular.name));
                  
                  const isMatched = dockedSuspects.length > 0;
                  const isOver = dragOverRegularId === regular.id;

                  const isRegularSelected = selectedRegularIds.has(regular.id);

                  return (
                    <div
                      key={regular.id}
                      data-regular-name={regular.name}
                      onClick={regularSelectMode ? () => toggleRegularSelection(regular.id) : undefined}
                      onDragOver={regularSelectMode ? undefined : (e) => handleDragOver(e, regular.id)}
                      onDragLeave={regularSelectMode ? undefined : handleDragLeave}
                      onDrop={regularSelectMode ? undefined : (e) => handleDrop(e, regular.name)}
                      className={`w-full rounded-2xl glass-card border p-4 flex flex-col gap-3 transition-all duration-300 ${
                        regularSelectMode ? "cursor-pointer" : ""
                      } ${
                        isRegularSelected
                          ? "border-red-500/40 bg-red-500/[0.03] ring-1 ring-red-500/20"
                          : isOver
                          ? "scale-[1.02] border-[var(--accent-solid)] bg-white/10"
                          : isMatched
                            ? "bg-emerald-500/[0.01] border-emerald-500/20"
                            : "border-white/5"
                      }`}
                      style={{
                        borderColor: isOver 
                          ? "var(--accent-solid)" 
                          : isMatched ? `${regular.color}45` : undefined,
                        boxShadow: isOver 
                          ? "var(--accent-glow)" 
                          : isMatched ? `inset 0 0 10px ${regular.color}08` : undefined
                      }}
                    >
                      {/* ポケットヘッダー：リスナー名と当て完了バッジ */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/5 shrink-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                          {regularSelectMode && !isBroadcastMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRegularSelection(regular.id);
                              }}
                              className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                              aria-label={isRegularSelected ? "選択解除" : "選択"}
                            >
                              {isRegularSelected ? (
                                <CheckSquare size={16} className="text-red-400" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          )}
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-[0_0_8px_currentColor]" 
                            style={{ backgroundColor: regular.color, color: regular.color }}
                          />
                          <TruncatedText
                            text={regular.name}
                            multiline={isBroadcastMode}
                            className={`tracking-wide ${
                              isBroadcastMode ? "broadcast-enlarge-text" : "text-xs font-semibold text-[var(--foreground)]"
                            }`}
                          />
                        </div>

                        {/* 当て完了ステータスバッジ・削除 */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isMatched && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 font-extrabold text-[8px] tracking-wide animate-pulse">
                              当て完了
                            </span>
                          )}
                          {!isMatched && linkedSuspects.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 dark:text-yellow-400 font-extrabold text-[8px] tracking-wide">
                              候補数: {linkedSuspects.length}
                            </span>
                          )}
                          {!isBroadcastMode && !regularSelectMode && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRegular(regular, e)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-white/10 bg-black/[0.03] text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/25 transition-colors cursor-pointer shrink-0"
                              title="リスナーを一覧から削除"
                            >
                              <Trash2 size={12} />
                              削除
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ポケット中身：ドラッグで分類された参加者たちの一覧 */}
                      <div className="space-y-2 flex-1">
                        
                        {/* A. 【予想段階】紐付け中の本命未決参加者バッジ一覧 */}
                        {linkedSuspects.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {linkedSuspects.map(suspect => (
                              <div
                                key={suspect.id}
                                className={`flex items-center gap-1.5 pl-2.5 rounded-lg border bg-black/10 dark:bg-white/5 border-white/5 text-[var(--foreground)] transition-colors hover:border-white/10 ${
                                  isBroadcastMode ? "pr-2.5 py-1.5" : "pr-1.5 py-1 font-medium text-[10px]"
                                }`}
                              >
                                <span className={`flex items-center gap-1 min-w-0 ${isBroadcastMode ? "broadcast-enlarge-sub" : ""}`}>
                                  <User size={10} className="shrink-0 opacity-60" />
                                  <TruncatedText text={suspect.fakeName} multiline={isBroadcastMode} className="flex-1" />
                                </span>
                                
                                {/* 解決（本命当て確定）ボタン（配信モード時は隠す） */}
                                {!isBroadcastMode && (
                                  <button
                                    onClick={() => handleToggleSolved(suspect.id, true)}
                                    className="p-0.5 rounded text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                    title="このリスナーで本命当てを確定する"
                                  >
                                    <CheckCircle2 size={11} />
                                  </button>
                                )}

                                {/* 紐付け解除ボタン（配信モード時は隠す） */}
                                {!isBroadcastMode && (
                                  <button
                                    onClick={() => toggleLink(suspect.id, regular.name)}
                                    className="p-0.5 rounded text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
                                    title="紐付けを解除"
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* B. 【当て完了段階】確定した参加者カード */}
                        {dockedSuspects.length > 0 && (
                          <div className="space-y-2 pt-1 border-t border-dashed border-emerald-500/10">
                            <div className="text-[9px] font-extrabold text-emerald-500 dark:text-emerald-400 flex items-center gap-0.5">
                              <Sparkles size={9} />
                              <span>当てた参加者:</span>
                            </div>

                            {dockedSuspects.map(suspect => (
                              <div
                                key={suspect.id}
                                className={`glass-panel-light rounded-xl border border-emerald-500/20 flex flex-col gap-2 relative shadow-[0_4px_10px_rgba(16,185,129,0.02)] ${
                                  isBroadcastMode ? "broadcast-matched-card broadcast-glow-strong" : "p-2.5 text-[9px]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <span className={`flex items-center gap-1 min-w-0 ${isBroadcastMode ? "broadcast-enlarge-text" : "font-semibold text-[var(--foreground)] text-[9px]"}`}>
                                    <UserCheck size={12} className="shrink-0 opacity-80" />
                                    <span className="shrink-0">偽名:</span>
                                    <TruncatedText text={suspect.fakeName} multiline={isBroadcastMode} className="flex-1" />
                                  </span>
                                  
                                  {/* 解除ボタン（配信モード時は隠す） */}
                                  {!isBroadcastMode && (
                                    <button
                                      onClick={() => handleToggleSolved(suspect.id, false)}
                                      className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-[var(--text-secondary)] hover:text-red-500 dark:hover:text-red-400 transition-colors font-bold text-[8px] cursor-pointer"
                                      title="本命当てを解除してデッキに戻す"
                                    >
                                      解除
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 何もドッキング/リンクされていない時のプレースホルダー */}
                        {linkedSuspects.length === 0 && dockedSuspects.length === 0 && (
                          <div className="h-full min-h-[44px] flex items-center justify-center border border-dashed border-white/5 rounded-xl text-[9px] text-[var(--text-secondary)] italic select-none">
                            空のリスナーポケット (ドラッグドロップで紐付け)
                          </div>
                        )}

                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
        }
      />
    </div>
  );
}
