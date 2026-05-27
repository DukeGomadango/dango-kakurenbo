export const siteMetadata = {
  name: "だんごかくれんぼ",
  title: "だんごかくれんぼ - ライバー向け進行・推理ツール",
  tagline: "ライバー向け進行・推理ツール",
  description:
    "リスナーの偽名・質問への回答・本名予想をリアルタイムで整理し、配信しながら推理を進めるためのWebツール。インストール不要。",
} as const;

export function getMetadataBase() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

  return new URL(url);
}
