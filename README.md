# 技工物 進行表｜アラート復活版

## 反映内容

- Supabase連携
- ログイン機能
- PC・スマホ・別PCでカード共有
- 間に合わない可能性があるカードの最上部アラート
- 必要日数判定
  - 印象 → 発注: 1日
  - 発注 → 承認: 7日
  - 承認 → 納品: 14日
- 赤・黄・緑のカード色分け
- モーダル形式のカード追加
- 装着予定日・来院予定日の説明付き
- 自由記入欄・メモ
- 装置カテゴリ順
  1. ラビアル
  2. リンガル
  3. アライナー
  4. バンド系装置
  5. リテーナー
  6. その他
- リテーナー詳細装置名
  - プレートタイプ
  - クリアリテーナー
  - ボンデッドリンガルリテーナー
- その他詳細装置名
  - バイトチェック
  - TPA
  - その他

## Vercel環境変数

VITE_SUPABASE_URL=https://xiflbktnmjzwdiavfdgz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_paj79HmcbGKtvsIHdRHkjg_Nu1G53mp

## Vercel設定

- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist
