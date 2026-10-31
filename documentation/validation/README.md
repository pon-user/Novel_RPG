# MVP v0.5 移行時のブラウザ検証

2026-10-31に移行先の `docs/` を `/Novel_RPG/` に配信して実行した結果です。[browser-report.json](browser-report.json) に実行日時・ブラウザバージョン・件数を記録しています。

PCとスマートフォン相当の両方で、5回の手動更新・全5節・4戦を実際の画面操作で完了しました。自動保存からの再読込、JSON書き出し／読み込み、破損データ保護も検証しています。テストソースは [test-browser.cjs](../../tests/test-browser.cjs) です。

| 画面 | PC 1440px | スマートフォン相当390px |
|---|---|---|
| 開始 | [開始画面](desktop-start.png) | [開始画面](mobile-start.png) |
| 第4戦の予約・NPC固定行動 | [戦闘準備](desktop-battle.png) | [戦闘準備](mobile-battle.png) |
| 5節・4戦の読了 | [序章完了](desktop-complete.png) | [序章完了](mobile-complete.png) |

画像はChromiumによる全ページのキャプチャです。スマートフォン実機での確認、Pagesへのデプロイ済みという意味ではありません。テスト再実行時の全画像とセーブJSONは、Git対象外の `artifacts/` に生成します。
