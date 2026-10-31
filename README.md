# 丘の向こうの道 — ノベルRPG MVP v0.6（レビュー版）

序章全5節・4戦を、1節ずつ手動更新で進める静的Webゲームです。この作業ブランチは、公開中のv0.5をもとにUI・読書・戦闘表示を改善する **v0.6のレビュー版**です。ゲーム本体は `docs/` にあり、無料の静的配信だけで動作します。今回のPRではmainへのマージ・Pages公開を行いません。

今後のゲーム開発・修正はこの `pon-user/Novel_RPG` で行います。Obsidian側は既存仕様・正式本文の参照元として保持し、移行後のゲーム実装はここで管理します。開発時の共通手順は [AGENTS.md](AGENTS.md) を参照してください。

## v0.6で改善した体験

- ホーム・物語・戦闘準備／経過／結果・履歴を分離。画面移動で読書位置や5ターン予約を失いません。
- 正式原稿とv0.5のページ境界はそのままに、段落・台詞・場面転換「◇」を表示側で整えます。本文のコントラストは実測 **14.41:1** です。
- 戦闘は全ターンの開始状態と行動を初期展開し、明示操作の後で勝敗を表示。回避・標的・溜め・被害を事実に沿って振り返れます。
- iPhone相当幅では読書領域を下部ナビの上に確保。現在地・持ちものはホームから確認できます。
- v0.5の保存キー・形式・原稿・戦闘数値を維持。旧セーブ3種を実際のファイル読込で検証しました。

[仕様差分とA/B/C/D対応表](documentation/v06-specification.md) ／ [実装・検証報告と比較画像](documentation/v06-validation/README.md)

今回のiPhone Safari実機フィードバックで、v0.5の表示・更新開始・読書復元・戦闘接続・JSONダウンロードの5項目が合格しています。これはv0.6の実機確認とは区別して保全します。

## 実装内容

- 正式稿の序章5節、4か所の戦闘、読書ページの移動、読了済みの物語・戦闘記録の読み返し。
- 「更新しない」を初期選択とする5回の手動更新。実時刻による待機・自動定刻更新はありません。
- アリアの5ターン技能予約、段階的な技能解禁、固定行動NPC、重複予約の拒否、勝敗・戦闘ログ、同じ節での再挑戦。
- 進行・読書位置・予約・結果・文字サイズの自動保存、JSON書き出し／読み込み、破損セーブの保護、保存容量不足時の警告。
- PCのサイドバーとスマートフォン向けの表示。第4戦後の固有技能習得、物語に沿った所持品の更新。

セーブは `localStorage['hill-road-prologue-v1']` に保存します。同じブラウザ・同じオリジン（プロトコル・ホスト・ポート）で再開できます。端末間の移動には「設定とセーブ」からJSONを書き出し／読み込みしてください。自動同期やサーバー側保存はありません。

ゲームの実行に外部API、データベース、課金サービス、npmの依存パッケージは不要です。HTML/CSS/JavaScriptだけで動作し、ホストから同梱ファイルを読み込む以外の外部通信を行いません。戦闘用の旧名ファイル `data.js`・`battle-c1.js` はv0.5が使う内部エンジンで、別の旧試遊版を公開するものではありません。

## ローカルで起動

Python 3とブラウザを用意し、リポジトリのルートで実行します。

```sh
python3 run.py
```

Windowsは `python run.py` または `start-local.cmd`、Macは `start-local.command` も利用できます。ブラウザが開かないときは `http://127.0.0.1:8765/` を開きます。終了は `Ctrl+C`。起動時の追加インストールやビルドは不要です。

```sh
# ブラウザを自動起動しない
python3 run.py --no-open
# 信頼できる同一LANのスマートフォンで確認する場合
python3 run.py --host 0.0.0.0 --no-open
```

LANではスマートフォンから `http://PCのLAN内IP:8765/` を開きます。標準はPC内だけに接続を許可します。毎回同じポートを使うと同じ保存先で再開できます。

## GitHub Pagesで公開する設定

公開用ファイルはすべて `docs/` にあります。相対パスで参照し、Jekyll処理を避ける `.nojekyll` を配置済みです。`/Novel_RPG/` のようなプロジェクトパスで全編動作を検証しています。

レビュー後、リポジトリの **Settings → Pages → Build and deployment** で以下を設定します。

1. Source: **Deploy from a branch**
2. Branch: **main**、Folder: **/docs**（mainへマージした後）
3. Save後、Pagesのデプロイ完了と画面表示を確認

マージ前のブランチを公開対象にする場合も Folder は **/docs** を選びます。公開先は <https://pon-user.github.io/Novel_RPG/> です。実際の公開状態はSettings → Pagesとデプロイ結果で確認してください。旧版が既に公開されている場合、その公開内容はPR作成だけでは切り替わりません。

GitHub Freeの公開リポジトリではGitHub Pagesを無料で利用できます。非公開リポジトリの場合は契約プランのPages対応を確認してください。ローカル起動はリポジトリの公開状態によらず無料です。

## ディレクトリ

```text
docs/                      ゲーム公開用の静的ファイルのみ
tests/                     本文・保存・戦闘・実ブラウザ試験
  fixtures/                本文／設計の出典照合用資料（公開サイト対象外）
documentation/
  migration-manifest.json  移行元コミットと本体9ファイルのSHA-256
  戦闘調整.md              移行元の戦闘仕様・検証境界
  validation/              実測レポートと代表画面
artifacts/                 テスト再実行時の出力（Git対象外）
run.py                     Python標準ライブラリによるdocs配信
.github/workflows/test.yml PR／main向けの自動試験
```

## テスト

ロジック試験はNode.js 22以上で実行できます。ブラウザ試験には無料のPlaywright・Chromiumを使います。バージョンは `package-lock.json` に固定しています。

```sh
npm test
npm ci
npx playwright install chromium
```

別のターミナルで `python3 run.py --no-open` を起動し、次を実行します。

```sh
# macOS / Linux
BASE_URL=http://127.0.0.1:8765/ npm run test:browser
```

```powershell
# Windows PowerShell
$env:BASE_URL='http://127.0.0.1:8765/'
npm run test:browser
```

ブラウザ試験の既定URLは `http://127.0.0.1:8765/Novel_RPG/` です。CIでは `docs/` をこのパスに割り当て、GitHub Pagesと同じ相対パス条件で検証します。`/usr/bin/chromium` がある環境ではそれを使い、なければPlaywrightのブラウザを使います。Linuxの依存ライブラリも必要な場合は `npx playwright install --with-deps chromium` を使います。

テストは新規ブラウザコンテキストを使い、普段のゲームセーブを変更しません。画面画像・JSONレポート・テスト用セーブは `artifacts/` に出力します。`ARTIFACTS_DIR` で変更できます。CIでも同じ試験を実行し、結果を14日間保持します。

## v0.5移行時の検証記録（2026-10-31）

| 検証 | 実測結果 |
|---|---|
| 本文と出典照合 | 129項目成功、48,391文字、全5節・4戦の位置を照合 |
| 保存・進行 | 127項目成功。全phaseの再開、敗北再挑戦、重複操作、破損保護、容量不足、入出力 |
| 戦闘 | 8,303項目成功、全674有効予約、技能解禁・固定NPC・旧内部エンジン互換 |
| 実Chromium | 182項目成功。PC 1440×1050とタッチ対応スマートフォン相当390×844で、それぞれ5節・4戦を完走 |
| 戦闘進行 | PC・スマートフォン双方で第1〜4戦が3・3・3・4ターンで勝利 |
| セーブUI | 書き出し→別コンテキストへ読み込み→再読込→再書き出しを確認。不正JSONは現在の進行を維持 |
| 表示・配信 | Pages相当の `/Novel_RPG/` で実行。390pxで読書・予約・結果、360／320pxで読了・読み返しの横はみ出しなし |
| 通信・例外 | 外部リクエスト、HTTPエラー、リクエスト失敗、JavaScript例外はいずれも0件 |
| 移行の同一性 | 本体9ファイルは移行元とバイト単位で同一。SHA-256を記録 |

[機械可読レポート](documentation/validation/browser-report.json) と [画面一覧](documentation/validation/README.md) をPR上で確認できます。検証環境はNode.js 24.19.0、Python 3.12.14、Playwright 1.62.1、Chromium 154.0.8037.57です。

GitHub ActionsのPR試験もコミット `ea9232c` で成功しました（[実行結果](https://github.com/pon-user/Novel_RPG/actions/runs/41179131246)）。`npm ci`、ロジック試験、Pagesと同じパスでのブラウザ試験を含みます。最新コミットの結果はPRのChecksで確認してください。

スマートフォンの試験はChromiumの表示幅・タッチエミュレーションです。iPhone Safari／Android実機とGitHub Pages上の公開動作は、この試験とは別です。第1章・サブストーリー・正式キャラクター画像・実時刻による定期更新は元のv0.5にも含まれていません。

## 移行元と保全

- リポジトリ: `pon-user/obsidian-vault`、[PR #1](https://github.com/pon-user/obsidian-vault/pull/1)
- ブランチ: `codex/prologue-manual-update-v05-20261031`
- 取得コミット: `af9b5e331c4940824869f251c730a3defe6d1fd0`（ブランチと `refs/pull/1/head` の一致を確認）
- 対象: `10_定刻進行ノベルゲーム/01_成果物/実装・配布/builds/HillRoad_v0.5_manual_update/`

本文の出典コミットとblob SHAはゲームデータと `tests/fixtures/manifest.json` に保持しています。[移行マニフェスト](documentation/migration-manifest.json) で、取得元の `dist/` と移行後の `docs/` を対応付けています。開発用ファイルは配置先・参照パスを変更し、ローカル配信先も `docs/` に変更しました。移行元リポジトリ・PR・正本ファイルは変更していません。
