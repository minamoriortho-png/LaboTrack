# 技工物 進行表 完成版

## 反映済み内容

- Supabase連携
- ログイン機能
- PC・スマホ・別PCでカード共有
- 装置カテゴリー順
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

Vercelの Environment Variables に以下を設定してください。

VITE_SUPABASE_URL=https://xiflbktnmjzwdiavfdgz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_paj79HmcbGKtvsIHdRHkjg_Nu1G53mp

## Supabase

SupabaseのSQL Editorで `supabase-schema.sql` を実行してください。

## Vercel設定

- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist
