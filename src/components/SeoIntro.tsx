import { siteMetadata } from "@/lib/site-metadata";

/** クローラ向けの説明テキスト（画面には表示しない） */
export default function SeoIntro() {
  return (
    <section aria-label={`${siteMetadata.name}について`} className="sr-only">
      <p>
        {siteMetadata.name}は、{siteMetadata.description}
      </p>
      <h2>主な機能</h2>
      <ul>
        <li>参加者一覧：リスナーの偽名・質問への回答・本名予想を表形式で管理</li>
        <li>推理キャンバス：配信画面向けに視覚的に推理・整理</li>
        <li>配信モード：OBS などの配信画面に最適化した表示</li>
        <li>リスナープリセットとデータ同期：複数 PC 間での設定の引き継ぎ</li>
      </ul>
      <h2>対象ユーザー</h2>
      <p>
        ライブ配信で「だんごかくれんぼ」などの推理ゲームを行う VTuber・ライバー、およびその配信スタッフ向けの無料 Web
        ツールです。
      </p>
    </section>
  );
}
