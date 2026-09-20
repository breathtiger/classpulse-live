# Google Apps Script 課堂互動系統

## 目前正式入口（GitHub Pages）

- 學員：https://breathtiger.github.io/classpulse-live/
- 講師：https://breathtiger.github.io/classpulse-live/Admin.html
- 投影：https://breathtiger.github.io/classpulse-live/Display.html

前端使用原生 JavaScript，透過 POST 呼叫 Apps Script，Google Sheets 為資料來源。講師密碼只在登入時傳送，後續使用限時憑證，不存入網址或公開檔案。QR Code 請指向學員入口；不需要無痕模式。

### 現場使用與重置

- 最後展示全程成果：講師登入後，點上方「全題統計總覽」→「全螢幕展示」。總表及下方每題圖表會保留第一題到最後一題的結果，不必重新開題，關閉作答也不會消失。文字題可展開全部回覆（不僅最近 30 則），可匯出 CSV 或列印成 PDF；Esc 離開全螢幕。
- 學員頁不再顯示「學員頁／講師頁」導覽連結。講師請直接使用既有 Admin.html 網址。

- 姓名後會出現性別、年齡、職業、居住縣市報到表單；更新題目不會重建同一份未送出表單。
- 學員依需求每 **60 秒**同步題目，也可按「立即更新題目」。講師每 5 秒同步；投影牆收到上次回應後隔 3 秒再次查詢，因此實際延遲還包含 Google 服務與網路時間，並非零延遲推播。
- 送出時立刻停用按鈕並顯示「傳輸中...」；收到後端確認才顯示「答案已送出」。逾時表示結果尚未確認，可安全重試，不會重複計票。
- 多人同時送出使用持久暫存與批次寫入：答案先暫存在 Script Properties，持有短鎖的請求一次寫入多份答案，提交成功後才回傳確認。暫時忙碌時前端會分散重試，持續顯示排隊提示；達到重試上限仍保留輸入。一般使用的題庫與正式資料仍以 Google Sheets 為準。
- 「開放中」為目前題目，「已開」為本次課堂曾開放題目，均由後端紀錄決定。
- 「清除全部測試資料並重置」需兩次確認，會清空報到／作答、關閉題目、清除已開紀錄，讓學員重新報到；**不會改動 Questions 題庫或 ADMIN_KEY**。刪除不可復原，正式課程資料不要清除。
- 回答原始資料在 Google Sheets 的 Responses，可由試算表「檔案 → 下載」匯出 CSV 或 Excel。投影不顯示學員姓名；開放題文字雲依最新 30 則回答中的逗號、頓號、空白切詞，完整回覆保存在試算表。

### 維護與回歸測試

GitHub Pages 發布 `index.html`、`Admin.html`、`Display.html` 與 `assets/`。後端更新時使用既有 Apps Script 部署 ID 發布新版本，保持網址不變。`.claspignore` 僅允許後端及 Apps Script 模板上傳，避免把瀏覽器程式誤當 Apps Script 執行。

執行 `node tests/backend.test.cjs` 可在記憶體模擬試算表驗證權限、重複送答、投票、複選、計分、匿名文字統計、關題、完整重置與題庫保留。Node 僅用於開發測試及部署，正式網站不需要 Node 或第三方套件。

`tests/load-test.cjs` 是真實 HTTP 併發測試，從 `CLASSPULSE_ADMIN_KEY` 環境變數讀取密碼，不將密碼寫入程式碼。`startLoadTest` 僅供已驗證講師建立隔離試算表；每次使用一個一小時到期的測試憑證，測試完成立即撤銷。使用同一 Apps Script 部署與同一寫入程式，因此共用實際執行限制，但不更動正式題庫、回答或開題狀態。隔離試算表只含合成壓测資料，可留存稽核。

以下為 Apps Script 原生模板的初始建置說明；正式課堂請使用上方三個入口，不要重新執行初始化或題庫安裝。

這是單一課程使用的手機優先 Web App；資料保存在 Google Sheets，沒有外部套件或 CDN。

## 建立與設定

1. 建立一個 Google 試算表，開啟「擴充功能 → Apps Script」。
2. 在 Apps Script 專案中建立 `Code.gs`、`Student.html`、`AdminApp.html`、`Styles.html`，分別貼入同名檔案內容；也將 `appsscript.json` 貼到專案設定檔。`Admin.html` 是 GitHub Pages 入口，與 `AdminApp.html` 原生模板不同。
3. 若此為「綁定式」指令碼（從該試算表開啟 Apps Script），不需要設定試算表 ID。若為獨立專案，至「專案設定 → 指令碼屬性」新增 `SPREADSHEET_ID`，值為試算表網址 `/d/` 與下一個 `/` 之間的字串。
4. 同一處新增 `ADMIN_KEY`，設定成長且難猜的隨機密碼。請勿把它放在公開教材。
5. 在編輯器選擇 `setupSpreadsheet` 後按「執行」，依提示授權。它會建立 `Questions`、`Responses`、`Settings`，並加入五題示範題。可在 `Questions` 自訂題目；`options` 使用 JSON 陣列，例如 `["是","否"]`，`enabled` 使用 `TRUE` 或 `FALSE`。

## 部署

1. 點選「部署 → 新增部署作業 → 網頁應用程式」。
2. 執行身分選「我」，存取權選「所有人」（校內限制可改成適當對象），按「部署」並完成授權。
3. 複製網址。學生使用原始網址；講師網址為 `原始網址?adminKey=你的_ADMIN_KEY`。`adminKey` 是簡易存取控制，不應公開分享。
4. 將學生網址貼到任意 QR Code 產生器或 Chrome 的「建立 QR Code」功能，即可投影或列印。不要用講師網址建立 QR Code。

## 操作

- 學員首次輸入名稱／匿名編號，瀏覽器會以 localStorage 保存。每題同一參與者只能送出一次；每 5 秒自動檢查新題。
- 講師台可點選題目開放、上一題／下一題，或「關閉作答」。統計與文字回答每 5 秒刷新。
- 「刪除所有測試回答」有兩次瀏覽器確認，會清空 `Responses` 的資料列但保留標題列。

## 工作表欄位

- `Questions`: `id, page, type, question, options, answer, points, enabled`
- `Responses`: `timestamp, participantId, participantName, questionId, answer, correct, score`
- `Settings`: `key, value`（系統使用 `activeQuestionId`）

題型為 `single`、`multiple`、`rating`、`open_text`、`quiz`。`quiz` 的 `answer` 填正確選項文字（複選可填 JSON 陣列），答對時計入 `points`。

## 注意事項

程式使用 Script Lock 避免同時寫入造成重複回答；前端與後端都會驗證輸入。若更換部署 URL，請重新產生學生 QR Code。先用無痕視窗以兩個不同名稱測試作答流程，再於講師台檢查統計。
