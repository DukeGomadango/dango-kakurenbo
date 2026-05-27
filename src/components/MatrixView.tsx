"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, CheckCircle2, Circle, Search, X, HelpCircle, UserCheck, Shield, ChevronRight, User, MessageSquare, CheckSquare, Square } from "lucide-react";
import type { Question, Regular, Suspect } from "@/lib/dango-types";
import { FloatingPopover } from "./FloatingPopover";
import { TruncatedText } from "./TruncatedText";
import { ResizableSplit } from "./ResizableSplit";
import {
  DANGO_STORAGE_KEYS,
  SPLIT_MATRIX_DEFAULT_PERCENT,
  SPLIT_BROADCAST_FIXED_PERCENT,
} from "../lib/dango-storage";
import { buildBulkSuspectDeleteMessage, buildSuspectDeleteMessage } from "../lib/dango-delete";

interface MatrixViewProps {
  suspects: Suspect[];
  setSuspects: (s: Suspect[]) => void;
  regulars: Regular[];
  questions: Question[];
  setQuestions: (q: Question[]) => void;
  isBroadcastMode: boolean;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showAlert: (title: string, message: string) => void;
}

export default function MatrixView({
  suspects,
  setSuspects,
  regulars,
  questions,
  setQuestions,
  isBroadcastMode,
  showConfirm,
  showAlert,
}: MatrixViewProps) {
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);
  const [suspectQuery, setSuspectQuery] = useState("");
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [isRegularDropdownOpen, setIsRegularDropdownOpen] = useState(false);

  // 参加者一括削除（選択モード）
  const [suspectSelectMode, setSuspectSelectMode] = useState(false);
  const [selectedSuspectIds, setSelectedSuspectIds] = useState<Set<string>>(() => new Set());

  const regularDropdownAnchorRef = useRef<HTMLButtonElement>(null);

  // 初回マウント時、または参加者が増えた際に、選択中が空であれば最初の参加者を選択
  useEffect(() => {
    if (suspects.length > 0 && !selectedSuspectId) {
      setSelectedSuspectId(suspects[0].id);
    }
  }, [suspects, selectedSuspectId]);


  // キーボード操作：ArrowUp/ArrowDownによる参加者切り替え
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (suspects.length === 0) return;
      
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      const currentIndex = suspects.findIndex(s => s.id === selectedSuspectId);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % suspects.length;
        setSelectedSuspectId(suspects[nextIndex].id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + suspects.length) % suspects.length;
        setSelectedSuspectId(suspects[prevIndex].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [suspects, selectedSuspectId]);

  // 新規参加者追加
  const handleAddSuspect = () => {
    const newId = `suspect-${Date.now()}`;
    const initialAnswers: Record<string, string> = {};
    questions.forEach(q => {
      initialAnswers[q.id] = "";
    });

    const newSuspect: Suspect = {
      id: newId,
      fakeName: `参加者 ${suspects.length + 1}`,
      answers: initialAnswers,
      realNameGuesses: [],
      isSolved: false,
      x: 25 + Math.random() * 45,
      y: 25 + Math.random() * 45,
    };

    setSuspects([...suspects, newSuspect]);
    setSelectedSuspectId(newId);
  };

  // 参加者データ更新
  const handleUpdateSuspect = (id: string, field: keyof Suspect, val: unknown) => {
    setSuspects(
      suspects.map(s => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  // 参加者の本名予想トグル
  const handleToggleGuess = (suspectId: string, name: string) => {
    setSuspects(
      suspects.map(s => {
        if (s.id === suspectId) {
          const currentGuesses = s.realNameGuesses || [];
          const exists = currentGuesses.includes(name);
          const nextGuesses = exists
            ? currentGuesses.filter(g => g !== name)
            : [...currentGuesses, name];
          return { ...s, realNameGuesses: nextGuesses };
        }
        return s;
      })
    );
  };

  // 参加者の回答更新
  const handleUpdateAnswer = (suspectId: string, questionId: string, value: string) => {
    setSuspects(
      suspects.map(s => {
        if (s.id === suspectId) {
          return {
            ...s,
            answers: {
              ...(s.answers || {}),
              [questionId]: value,
            },
          };
        }
        return s;
      })
    );
  };

  const executeDeleteSuspect = (id: string) => {
    const remaining = suspects.filter(s => s.id !== id);
    setSuspects(remaining);
    if (selectedSuspectId === id) {
      setSelectedSuspectId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleDeleteSuspect = (id: string) => {
    const target = suspects.find(s => s.id === id);
    if (!target) return;

    showConfirm(
      "参加者の削除",
      buildSuspectDeleteMessage(target, questions),
      () => executeDeleteSuspect(id)
    );
  };

  const exitSuspectSelectMode = () => {
    setSuspectSelectMode(false);
    setSelectedSuspectIds(new Set());
  };

  const toggleSuspectSelection = (suspectId: string) => {
    setSelectedSuspectIds(prev => {
      const next = new Set(prev);
      if (next.has(suspectId)) next.delete(suspectId);
      else next.add(suspectId);
      return next;
    });
  };

  // 質問（詳細ペイン内）の追加
  const handleAddQuestion = () => {
    const newId = `q-${Date.now()}`;
    const newQuestions = [...questions, { id: newId, text: `新しい質問 ${questions.length + 1}` }];
    setQuestions(newQuestions);
  };

  // 質問の削除
  const handleRemoveQuestion = (qId: string) => {
    if (questions.length <= 1) {
      showAlert("質問の削除不可", "少なくとも1つの質問が必要です。");
      return;
    }
    showConfirm("質問の削除", "この質問と全員の回答データを削除しますか？", () => {
      setQuestions(questions.filter(q => q.id !== qId));
      setSuspects(
        suspects.map(s => {
          const newAnswers = { ...(s.answers || {}) };
          delete newAnswers[qId];
          return { ...s, answers: newAnswers };
        })
      );
    });
  };

  // 質問名の変更
  const handleRenameQuestion = (qId: string, text: string) => {
    setQuestions(
      questions.map(q => (q.id === qId ? { ...q, text } : q))
    );
  };

  // 検索フィルタされた参加者リスト
  const filteredSuspects = suspects.filter(s =>
    (s.fakeName || "").toLowerCase().includes(suspectQuery.toLowerCase())
  );

  const selectAllFilteredSuspects = () => {
    setSelectedSuspectIds(new Set(filteredSuspects.map(s => s.id)));
  };

  const handleBulkDeleteSuspects = () => {
    const ids = [...selectedSuspectIds];
    if (ids.length === 0) {
      showAlert("未選択", "削除する参加者を選択してください。");
      return;
    }
    showConfirm(
      "参加者の一括削除",
      buildBulkSuspectDeleteMessage(ids.length),
      () => {
        const idSet = new Set(ids);
        const remaining = suspects.filter(s => !idSet.has(s.id));
        setSuspects(remaining);
        if (selectedSuspectId && idSet.has(selectedSuspectId)) {
          setSelectedSuspectId(remaining.length > 0 ? remaining[0].id : null);
        }
        exitSuspectSelectMode();
      }
    );
  };

  // リスナーのFuzzy検索
  const filteredRegulars = regulars.filter(r =>
    r.name.toLowerCase().includes(dropdownSearch.toLowerCase())
  );

  const selectedSuspect = suspects.find(s => s.id === selectedSuspectId);

  return (
    <ResizableSplit
      storageKey={DANGO_STORAGE_KEYS.splitMatrix}
      defaultLeftPercent={isBroadcastMode ? SPLIT_BROADCAST_FIXED_PERCENT : SPLIT_MATRIX_DEFAULT_PERCENT}
      disabled={isBroadcastMode}
      className={`transition-all duration-300 ${
        isBroadcastMode ? "h-[calc(100vh-120px)] min-h-[550px]" : "h-[calc(100vh-190px)] min-h-[560px]"
      }`}
      left={
      <div className="h-full glass-panel rounded-2xl p-4 flex flex-col overflow-hidden border border-white/10 select-none">
        
        {/* リストコントロールヘッダー */}
        <div className="space-y-3 pb-3 border-b border-white/5 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-extrabold text-[var(--foreground)] tracking-wider">参加者リスト</h2>
              <p className="text-[10px] text-[var(--text-secondary)]">
                登録参加者: {suspects.length}人 {!isBroadcastMode && "(選択: ↕キー)"}
              </p>
            </div>
            
            {/* 追加・一括削除（配信モード時は非表示） */}
            {!isBroadcastMode && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (suspectSelectMode) exitSuspectSelectMode();
                    else setSuspectSelectMode(true);
                  }}
                  disabled={suspects.length === 0 && !suspectSelectMode}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                    suspectSelectMode
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-black/10 dark:bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Trash2 size={13} />
                  {suspectSelectMode ? "選択終了" : "選択して削除"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exitSuspectSelectMode();
                    handleAddSuspect();
                  }}
                  className="glass-btn-accent px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus size={14} />
                  追加
                </button>
              </div>
            )}
          </div>

          {/* 一括削除ツールバー */}
          {suspectSelectMode && !isBroadcastMode && (
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-red-500/[0.04] border border-red-500/15 animate-fadeIn">
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                {selectedSuspectIds.size}人選択中
                {suspectQuery && `（検索結果 ${filteredSuspects.length}人）`}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={selectAllFilteredSuspects}
                  disabled={filteredSuspects.length === 0}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold border border-white/10 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/[0.05] disabled:opacity-40"
                >
                  {suspectQuery ? "検索結果を全選択" : "すべて選択"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSuspectIds(new Set())}
                  disabled={selectedSuspectIds.size === 0}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold border border-white/10 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/[0.05] disabled:opacity-40"
                >
                  選択解除
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSuspects}
                  disabled={selectedSuspectIds.size === 0}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {selectedSuspectIds.size > 0 ? `${selectedSuspectIds.size}人を削除` : "削除"}
                </button>
              </div>
            </div>
          )}

          {/* クイック検索バー（配信モード時は非表示） */}
          {!isBroadcastMode && (
            <div className="relative animate-fadeIn">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="偽名で検索..."
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

        {/* 参加者スクロールリスト */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1 scrollbar-thin">
          {filteredSuspects.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-secondary)] text-xs py-16">
              <Shield size={20} className="mb-2 text-[#71717a] opacity-50" />
              参加者は見つかりません。
            </div>
          ) : (
            filteredSuspects.map(suspect => {
              const isSelected = suspect.id === selectedSuspectId;
              const isBulkSelected = selectedSuspectIds.has(suspect.id);
              
              const totalQ = questions.length;
              const answeredQ = questions.filter(q => suspect.answers && suspect.answers[q.id]?.trim()).length;
              const suspectGuesses = suspect.realNameGuesses || [];
              const assignedRegulars = regulars.filter(r => suspectGuesses.includes(r.name));

              return (
                <div
                  key={suspect.id}
                  onClick={() => {
                    if (suspectSelectMode) toggleSuspectSelection(suspect.id);
                    else setSelectedSuspectId(suspect.id);
                  }}
                  className={`w-full rounded-xl border p-3 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                    suspectSelectMode && isBulkSelected
                      ? "bg-red-500/[0.04] border-red-500/35 ring-1 ring-red-500/15"
                      : isSelected
                      ? "bg-white/5 border-[var(--accent-solid)] shadow-[0_4px_15px_rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.08)]"
                      : "border-white/5 hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 flex-1 pr-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {suspectSelectMode && !isBroadcastMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSuspectSelection(suspect.id);
                          }}
                          className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--foreground)] mt-0.5"
                          aria-label={isBulkSelected ? "選択解除" : "選択"}
                        >
                          {isBulkSelected ? (
                            <CheckSquare size={15} className="text-red-400" />
                          ) : (
                            <Square size={15} />
                          )}
                        </button>
                      )}
                      {suspect.isSolved ? (
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5 animate-pulse" />
                      ) : (
                        <Circle size={14} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
                      )}
                      <TruncatedText
                        text={suspect.fakeName}
                        multiline={isBroadcastMode}
                        className={`text-[var(--foreground)] ${
                          suspect.isSolved ? "line-through opacity-50" : ""
                        } ${isBroadcastMode ? "broadcast-enlarge-text" : "text-xs font-semibold"}`}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-[9px] text-[var(--text-secondary)]">
                      <span className={`shrink-0 font-medium flex items-center gap-0.5 ${isBroadcastMode ? "broadcast-enlarge-sub" : ""}`}>
                        <MessageSquare size={9} />
                        {answeredQ}/{totalQ} 回答
                      </span>
                      {assignedRegulars.length > 0 && (
                        <div className="flex gap-0.5 items-center overflow-hidden truncate">
                          <ChevronRight size={8} />
                          {assignedRegulars.map(r => (
                            <span 
                              key={r.id}
                              className="w-1.5 h-1.5 rounded-full inline-block shrink-0 shadow-[0_0_4px_currentColor]"
                              style={{ backgroundColor: r.color, color: r.color }}
                              title={r.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isBroadcastMode && !suspectSelectMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSuspect(suspect.id);
                        }}
                        className="p-1.5 rounded-lg border border-transparent text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors cursor-pointer"
                        title="参加者を削除"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <ChevronRight size={14} className={`text-[var(--text-secondary)] transition-transform ${isSelected ? "translate-x-0.5 scale-110 text-[var(--accent-solid)]" : ""}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      }
      right={
      <div className="h-full flex flex-col min-h-0">
        {!selectedSuspect ? (
          <div className="glass-panel rounded-2xl flex-1 flex flex-col items-center justify-center text-center p-8 border border-white/10 select-none">
            <HelpCircle size={32} className="mb-3 text-[var(--text-secondary)] opacity-50" />
            <h3 className="text-sm font-bold text-[var(--foreground)] mb-1">参加者が選択されていません</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs">
              左ペインから質問したい参加者を選択するか、新しく「追加」をクリックして記録を作成してください。
            </p>
          </div>
        ) : (
          <div className={`glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden border border-white/10 transition-all duration-300 ${
            isBroadcastMode ? "border-violet-500/10 shadow-[inset_0_0_20px_rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.02)]" : ""
          }`}>
            
            {/* 詳細ヘッダー（参加者メタデータ） */}
            <div className="p-5 border-b border-white/5 space-y-4 shrink-0 bg-white/[0.01]">
              
              {/* 名前、本命当てトグル、削除 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-bg)", border: "1px solid var(--accent-border)" }}>
                    <User size={18} style={{ color: "var(--accent-solid)" }} />
                  </div>
                  {isBroadcastMode ? (
                    <TruncatedText
                      text={selectedSuspect.fakeName}
                      multiline
                      className="broadcast-enlarge-text broadcast-suspect-name text-[var(--foreground)] select-text"
                    />
                  ) : (
                    <input
                      type="text"
                      className="bg-transparent border-none text-base font-extrabold text-[var(--foreground)] w-full outline-none focus:ring-0 p-0 border-b border-transparent focus:border-white/10 transition-colors"
                      value={selectedSuspect.fakeName}
                      onChange={(e) => handleUpdateSuspect(selectedSuspect.id, "fakeName", e.target.value)}
                      placeholder="参加者の偽名を入力..."
                    />
                  )}
                </div>

                {/* アクションボタン（配信モード時はトグルせず静的バッジにする） */}
                <div className="flex items-center gap-2 shrink-0">
                  {isBroadcastMode ? (
                    selectedSuspect.isSolved && (
                      <span className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-pulse">
                        <CheckCircle2 size={13} />
                        本命当て完了
                      </span>
                    )
                  ) : (
                    <>
                      {/* 本命当て確定スイッチ */}
                      <button
                        onClick={() => handleUpdateSuspect(selectedSuspect.id, "isSolved", !selectedSuspect.isSolved)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedSuspect.isSolved
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                            : "bg-black/10 dark:bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        本命当てとして確定
                      </button>

                      {/* 削除ボタン */}
                      <button
                        onClick={() => handleDeleteSuspect(selectedSuspect.id)}
                        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/10 cursor-pointer"
                        title="この参加者の記録を完全削除"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 本名予想の複数選択マルチバッジ */}
              <div className="flex items-center gap-3 text-xs pt-1 border-t border-white/5">
                <span className={`text-[var(--text-secondary)] font-bold shrink-0 ${isBroadcastMode ? "broadcast-enlarge-sub" : ""}`}>
                  本名予想:
                </span>
                
                <div className="flex flex-wrap items-center gap-1.5 flex-1 relative">
                  {(selectedSuspect.realNameGuesses || []).map(gName => {
                    const matchedReg = regulars.find(r => r.name === gName);
                    return (
                      <span
                        key={gName}
                        className={`rounded-full font-bold border flex items-center shrink-0 transition-all ${
                          isBroadcastMode 
                            ? "px-3 py-1 text-xs border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--foreground)]" 
                            : "px-2 py-0.5 text-[10px]"
                        }`}
                        style={{
                          backgroundColor: matchedReg ? `${matchedReg.color}15` : undefined,
                          borderColor: matchedReg ? `${matchedReg.color}35` : undefined,
                          color: matchedReg ? matchedReg.color : undefined,
                        }}
                      >
                        <span 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{ backgroundColor: matchedReg?.color || "var(--accent-solid)" }}
                        />
                        <span className="ml-1 select-text">{gName}</span>
                        
                        {/* 削除ボタン（配信モード時は非表示） */}
                        {!isBroadcastMode && (
                          <button
                            onClick={() => handleToggleGuess(selectedSuspect.id, gName)}
                            className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 ml-1 transition-colors cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </span>
                    );
                  })}

                  {/* 予想追加ボタンとポップアップ（配信モード時は隠す） */}
                  {!isBroadcastMode && (
                    <>
                      <button
                        ref={regularDropdownAnchorRef}
                        onClick={() => {
                          if (regulars.length === 0) {
                            showAlert("リスナーが未登録", "先に右上のデータ管理から、または「推理キャンバス」でリスナーを登録してください。");
                            return;
                          }
                          setIsRegularDropdownOpen(!isRegularDropdownOpen);
                        }}
                        className="px-2 py-0.5 rounded-full border border-white/8 hover:border-white/20 text-[var(--text-secondary)] hover:text-[var(--foreground)] text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        aria-expanded={isRegularDropdownOpen}
                        aria-haspopup="listbox"
                      >
                        <Plus size={10} />
                        候補を追加
                      </button>

                      <FloatingPopover
                        open={isRegularDropdownOpen}
                        onOpenChange={(open) => {
                          setIsRegularDropdownOpen(open);
                          if (!open) setDropdownSearch("");
                        }}
                        reference={regularDropdownAnchorRef}
                        className="p-2.5 w-56 space-y-2 overflow-y-auto scrollbar-thin"
                        placement="bottom-start"
                      >
                        <div className="relative">
                          <Search size={12} className="absolute left-2 top-2 text-[var(--text-secondary)]" />
                          <input
                            type="text"
                            placeholder="リスナーを検索..."
                            value={dropdownSearch}
                            onChange={(e) => setDropdownSearch(e.target.value)}
                            className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-lg pl-7 pr-6 py-1 text-[10px] outline-none focus:border-violet-500 text-[var(--foreground)]"
                          />
                        </div>

                        <div className="space-y-0.5">
                          {filteredRegulars.length === 0 ? (
                            <div className="text-[10px] text-[var(--text-secondary)] text-center py-2">一致するリスナーがいません</div>
                          ) : (
                            filteredRegulars.map(reg => {
                              const isChecked = (selectedSuspect.realNameGuesses || []).includes(reg.name);
                              return (
                                <button
                                  key={reg.id}
                                  onClick={() => handleToggleGuess(selectedSuspect.id, reg.name)}
                                  className="w-full text-left px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[10px] flex items-center justify-between text-[var(--foreground)] cursor-pointer gap-2"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: reg.color }} />
                                    <TruncatedText text={reg.name} className="flex-1" />
                                  </div>
                                  {isChecked && <UserCheck size={12} className="text-emerald-500 shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </FloatingPopover>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 詳細ボディ（質問回答フォーム） */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
              
              <div className="text-xs font-bold text-[var(--text-secondary)] tracking-wider uppercase flex items-center gap-1.5 pb-1.5 border-b border-white/5 select-none">
                <span>質問と回答</span>
                {!isBroadcastMode && (
                  <span className="text-[9px] lowercase font-normal">（ヘッダーをクリックして質問自体を直接編集できます）</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {questions.map((q, idx) => {
                  const value = (selectedSuspect.answers && selectedSuspect.answers[q.id]) || "";
                  
                  return (
                    <div 
                      key={q.id}
                      className="glass-panel-light p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors flex flex-col gap-2.5 group relative"
                    >
                      {/* 質問見出し */}
                      <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
                        <div className="flex items-center gap-1 flex-1">
                          <span className={`font-bold text-[var(--text-secondary)] shrink-0 ${isBroadcastMode ? "broadcast-enlarge-sub" : "text-[10px]"}`}>
                            Q{idx + 1}:
                          </span>
                          
                          {/* 配信モード時は静的テキスト、通常時はインライン編集インプット */}
                          {isBroadcastMode ? (
                            <TruncatedText
                              text={q.text}
                              className="broadcast-enlarge-sub text-[var(--text-secondary)] px-1"
                            />
                          ) : (
                            <input
                              type="text"
                              value={q.text}
                              onChange={(e) => handleRenameQuestion(q.id, e.target.value)}
                              className="bg-transparent border-none text-[10px] font-extrabold text-[var(--text-secondary)] w-full outline-none focus:ring-0 p-0 hover:bg-black/10 dark:hover:bg-white/5 px-1 rounded transition-colors"
                              placeholder="質問内容を編集..."
                            />
                          )}
                        </div>

                        {/* 質問自体の削除ボタン（配信モード時は非表示） */}
                        {!isBroadcastMode && (
                          <button
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="p-1 rounded text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer animate-fadeIn"
                            disabled={questions.length <= 1}
                            title="この質問を削除"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* 回答エリア */}
                      {isBroadcastMode ? (
                        <div className="w-full bg-black/10 dark:bg-black/25 border border-white/5 rounded-lg px-3 py-2 broadcast-enlarge-text text-[var(--foreground)] min-h-[50px] whitespace-pre-wrap select-text shadow-sm border-violet-500/10">
                          {value || "（未回答）"}
                        </div>
                      ) : (
                        <textarea
                          rows={2}
                          className="w-full bg-black/10 dark:bg-black/35 border border-white/5 rounded-lg px-3 py-2 text-xs outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-[var(--foreground)] resize-none"
                          placeholder="回答を入力..."
                          value={value}
                          onChange={(e) => handleUpdateAnswer(selectedSuspect.id, q.id, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 質問を追加するボタン（配信モード時は隠す） */}
              {!isBroadcastMode && (
                <button
                  onClick={handleAddQuestion}
                  className="w-full py-4.5 rounded-xl border border-dashed border-white/10 hover:border-white/20 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] flex items-center justify-center gap-2 hover:bg-white/[0.01] transition-all cursor-pointer animate-fadeIn"
                >
                  <Plus size={16} style={{ color: "var(--accent-solid)" }} />
                  新しい質問を追加する
                </button>
              )}
            </div>
            
          </div>
        )}
      </div>
      }
    />
  );
}
