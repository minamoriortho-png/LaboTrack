# 技工物 進行表

## ログイン情報

- ユーザー名: admin
- パスワード: lab2026

## 修正内容

全装置カテゴリ表示時にカードが重なって見えない問題を修正しました。
装置カテゴリごとに独立したセクションを縦並び表示するため、全装置表示でもカードが重なりません。

## Vercel設定

このフォルダをGitHubリポジトリ直下に置く場合:

- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist
- Root Directory: 空欄

リポジトリ直下にさらに `lab-progress-app-category-section-fixed` フォルダとして置く場合:

- Root Directory: lab-progress-app-category-section-fixed

## 注意

このログインはフロントエンドだけの簡易ログインです。
本番で患者情報を扱う場合は、Vercel Authentication、Supabase Auth、Firebase Authなどを導入してください。
