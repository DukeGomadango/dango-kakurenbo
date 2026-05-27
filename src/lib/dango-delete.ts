import type { Question, Regular, Suspect } from "@/lib/dango-types";

export function buildSuspectDeleteMessage(suspect: Suspect, questions: Question[]): string {
  const parts: string[] = [];
  const answered = questions.filter(q => suspect.answers?.[q.id]?.trim()).length;
  if (answered > 0) parts.push(`回答 ${answered}件`);
  const guesses = (suspect.realNameGuesses || []).length;
  if (guesses > 0) parts.push(`本名予想 ${guesses}件`);
  if (suspect.isSolved) parts.push("本命当て完了");

  const detail = parts.length > 0 ? `\n（${parts.join("・")}）` : "";
  const label = suspect.fakeName?.trim() || "参加者";
  return `「${label}」の記録を完全に削除しますか？${detail}\nこの操作は取り消せません。`;
}

/** リスナー削除の参加者側への影響件数 */
export function countRegularDeleteImpact(
  suspects: Suspect[],
  regularName: string
): { linked: number; solved: number } {
  let linked = 0;
  let solved = 0;
  for (const s of suspects) {
    if (!(s.realNameGuesses || []).includes(regularName)) continue;
    if (s.isSolved) solved++;
    else linked++;
  }
  return { linked, solved };
}

export function buildRegularDeleteMessage(
  regularName: string,
  impact: { linked: number; solved: number }
): string {
  const { linked, solved } = impact;
  if (linked === 0 && solved === 0) {
    return `「${regularName}」をリスナー一覧から削除しますか？`;
  }
  const parts: string[] = [];
  if (linked > 0) parts.push(`紐付け中 ${linked}名`);
  if (solved > 0) parts.push(`当て完了 ${solved}名`);
  return `「${regularName}」をリスナー一覧から削除しますか？\n参加者側からもこの名前を外します（${parts.join("・")}）。\nこの操作は取り消せません。`;
}

/** リスナー名を全参加者の予想から除去し、予想が空なら本命当ても解除 */
export function stripRegularFromSuspects(suspects: Suspect[], regularName: string): Suspect[] {
  return suspects.map(s => {
    const current = s.realNameGuesses || [];
    if (!current.includes(regularName)) return s;
    const nextGuesses = current.filter(g => g !== regularName);
    return {
      ...s,
      realNameGuesses: nextGuesses,
      isSolved: nextGuesses.length === 0 ? false : s.isSolved,
    };
  });
}

export function applyRegularDelete(
  regulars: Regular[],
  regularId: string,
  regularName: string,
  suspects: Suspect[]
): { regulars: Regular[]; suspects: Suspect[] } {
  return {
    regulars: regulars.filter(r => r.id !== regularId),
    suspects: stripRegularFromSuspects(suspects, regularName),
  };
}

/** 複数リスナー削除時の参加者側への影響（参加者ごとに1回だけカウント） */
export function countBulkRegularDeleteImpact(
  suspects: Suspect[],
  regularNames: string[]
): { linked: number; solved: number } {
  const nameSet = new Set(regularNames);
  let linked = 0;
  let solved = 0;
  for (const s of suspects) {
    const affected = (s.realNameGuesses || []).some(g => nameSet.has(g));
    if (!affected) continue;
    if (s.isSolved) solved++;
    else linked++;
  }
  return { linked, solved };
}

export function buildBulkRegularDeleteMessage(
  count: number,
  impact: { linked: number; solved: number }
): string {
  let msg = `${count}人のリスナーを一覧から削除しますか？`;
  if (impact.linked + impact.solved > 0) {
    const parts: string[] = [];
    if (impact.linked > 0) parts.push(`紐付け中 ${impact.linked}名`);
    if (impact.solved > 0) parts.push(`当て完了 ${impact.solved}名`);
    msg += `\n参加者側からもこの名前を外します（${parts.join("・")}）。`;
  }
  msg += "\nこの操作は取り消せません。";
  return msg;
}

export function applyBulkRegularDelete(
  regulars: Regular[],
  regularIds: string[],
  suspects: Suspect[]
): { regulars: Regular[]; suspects: Suspect[] } {
  const idSet = new Set(regularIds);
  const namesToStrip = regulars.filter(r => idSet.has(r.id)).map(r => r.name);
  let nextSuspects = suspects;
  for (const name of namesToStrip) {
    nextSuspects = stripRegularFromSuspects(nextSuspects, name);
  }
  return {
    regulars: regulars.filter(r => !idSet.has(r.id)),
    suspects: nextSuspects,
  };
}

export function buildBulkSuspectDeleteMessage(count: number): string {
  return `${count}人の参加者の記録を完全に削除しますか？\nこの操作は取り消せません。`;
}
