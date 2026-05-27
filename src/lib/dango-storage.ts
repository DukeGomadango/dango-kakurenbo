/** localStorage キー（アプリ全体で統一） */
export const DANGO_STORAGE_KEYS = {
  accent: "dango_accent",
  questions: "dango_questions_dynamic",
  regulars: "dango_regulars",
  suspects: "dango_suspects_dynamic",
  theme: "dango_theme",
  presets: "dango_regular_presets",
  revision: "dango_storage_revision",
  splitBoard: "dango_split_board",
  splitMatrix: "dango_split_matrix",
} as const;

/** 推理キャンバス左ペイン初期比率（旧 4/12 よりやや広め） */
export const SPLIT_BOARD_DEFAULT_PERCENT = 38;
/** 参加者一覧左ペイン初期比率（右の編集ペインを広め） */
export const SPLIT_MATRIX_DEFAULT_PERCENT = 30;
/** 配信モード時の固定比率（旧 4/12） */
export const SPLIT_BROADCAST_FIXED_PERCENT = 33.33;

const SYNC_KEYS = new Set<string>([
  DANGO_STORAGE_KEYS.accent,
  DANGO_STORAGE_KEYS.questions,
  DANGO_STORAGE_KEYS.regulars,
  DANGO_STORAGE_KEYS.suspects,
  DANGO_STORAGE_KEYS.theme,
  DANGO_STORAGE_KEYS.presets,
  DANGO_STORAGE_KEYS.revision,
]);

export function isDangoSyncStorageKey(key: string | null): boolean {
  return key !== null && SYNC_KEYS.has(key);
}

/** 他タブへ変更通知するためのリビジョンキーを更新 */
export function touchStorageRevision(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DANGO_STORAGE_KEYS.revision, String(Date.now()));
  } catch {
    // quota 等は握りつぶす
  }
}

export interface StorageSnapshot {
  accent: string | null;
  questions: string | null;
  regulars: string | null;
  suspects: string | null;
  theme: string | null;
  presets: string | null;
  revision: string | null;
}

export function readStorageSnapshot(): StorageSnapshot {
  if (typeof window === "undefined") {
    return {
      accent: null,
      questions: null,
      regulars: null,
      suspects: null,
      theme: null,
      presets: null,
      revision: null,
    };
  }
  return {
    accent: localStorage.getItem(DANGO_STORAGE_KEYS.accent),
    questions: localStorage.getItem(DANGO_STORAGE_KEYS.questions),
    regulars: localStorage.getItem(DANGO_STORAGE_KEYS.regulars),
    suspects: localStorage.getItem(DANGO_STORAGE_KEYS.suspects),
    theme: localStorage.getItem(DANGO_STORAGE_KEYS.theme),
    presets: localStorage.getItem(DANGO_STORAGE_KEYS.presets),
    revision: localStorage.getItem(DANGO_STORAGE_KEYS.revision),
  };
}
