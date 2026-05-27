export const siteMetadata = {
  name: "だんごかくれんぼ",
  title: "だんごかくれんぼ - ライバー専用ゲーム管理＆推理キャンバス",
  tagline: "ライバー専用ゲーム管理＆推理キャンバス",
  description:
    "リスナーの変装（偽名・質問回答・本名）をリアルタイムで整理し、視覚的に推理するためのAppleスタイルのスタンドアロンWebアプリケーションです。",
} as const;

export function getMetadataBase() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  return new URL(url);
}
