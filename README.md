# 技工物 進行表｜装着予定日アラート・前回来院日版

## 今回の修正

- リンガルの詳細装置名に AIS を追加
- その他の詳細装置名に サージカルガイド を追加
- 来院予定日 表示を 前回来院日 に変更
- 間に合わない可能性のアラート判定を 装着予定日 のみに紐づけ
- 日程フィルターも装着予定日基準に変更
- SupabaseのDBカラム名は互換性維持のため visit_date のまま使用

## 詳細装置名

### ラビアル
- INSIGNIA
- ODB
- InhouseIDB
- DBS

### リンガル
- WINsystem
- ハーモニー
- AIS

### アライナー
- Angel Aligner
- SPARK
- Inhouse Aligner

### リテーナー
- プレートタイプ
- クリアリテーナー
- ボンデッドリンガルリテーナー

### その他
- バイトチェック
- TPA
- サージカルガイド
- その他

## Vercel環境変数

VITE_SUPABASE_URL=https://xiflbktnmjzwdiavfdgz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_paj79HmcbGKtvsIHdRHkjg_Nu1G53mp

## Vercel設定

- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist
