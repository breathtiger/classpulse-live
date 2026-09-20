# Google Apps Script 課堂互動系統

這是單一課程使用的手機優先 Web App；資料保存在 Google Sheets，沒有外部套件或 CDN。

## 建立與設定

1. 建立一個 Google 試算表，開啟「擴充功能 → Apps Script」。
2. 在 Apps Script 專案中建立 `Code.gs`、`Student.html`、`Admin.html`、`Styles.html`，分別貼入同名檔案內容；也將 `appsscript.json` 貼到專案設定檔。
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
