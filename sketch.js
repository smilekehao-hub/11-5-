// ==========================================
// Google 試算表 CSV 連結設定
// ==========================================
// 請將下方字串替換為你在 Google 試算表「發布到網路」所取得的 CSV 網址
const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRHAw5SmagF1P3KbqSbOGltB27W9lfGrtwAvhqTnyW9iNul1l5yQEWX1-eQ_dhxDK489ryG_ARl83b/pub?gid=0&single=true&output=csv";

// 全域變數宣告
let rawQuestions = [];         // 從 Google Sheet 載入的所有原始題目
let questions = [];            // 隨機抽取並洗牌後的 10 題
let currentQ = 0;              // 當前進行的題號索引 (0 ~ 9)
let score = 0;                 // 答對題數
let selectedOption = -1;       // 當前題目玩家點擊的選項 (-1 表示尚未選擇)
let isAnswered = false;        // 目前題目是否已回答
let isLoading = true;          // 資料載入狀態
let loadErrorMsg = "";         // 錯誤訊息紀錄

// 視覺與動畫狀態變數
let shakeTime = 0;             // 答錯選項的左右晃動計時器
let bounceTime = 0;            // 正確選項的上下跳動計時器
let confetti = [];             // 彩帶粒子陣列
let cracks = [];               // 答錯選項上的裂紋點座標陣列

// 字型變數（設定為 Redaction 20 與 Noto Serif HK）
let fontChinese = 'Noto Serif HK';
let fontEnglish = 'Redaction 20';

// ==========================================
// p5.js setup 初始化與非同步讀取 CSV
// ==========================================
function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  rectMode(CORNER);
  textAlign(CENTER, CENTER);

  // 開始異步讀取 Google 試算表
  fetchGoogleSheetCSV();
}

// 使用 fetch 讀取 Google 試算表 CSV 內容
function fetchGoogleSheetCSV() {
  fetch(sheetCsvUrl)
    .then(response => {
      if (!response.ok) throw new Error("HTTP 狀態碼 " + response.status);
      return response.text();
    })
    .then(csvText => {
      parseCSVData(csvText);
      if (rawQuestions.length > 0) {
        startNewQuizSession(); // 初始化抽題與洗牌
      } else {
        loadErrorMsg = "試算表中無有效的題目資料，請檢查欄位格式。";
      }
      isLoading = false;
    })
    .catch(err => {
      console.error("試算表載入失敗：", err);
      loadErrorMsg = "無法載入 Google 試算表，請確認連結權限或網路連線。";
      isLoading = false;
    });
}

// 解析 CSV 文字字串為 JSON 物件陣列
function parseCSVData(csvText) {
  let lines = csvText.trim().split("\n");
  if (lines.length <= 1) return;

  rawQuestions = [];
  // 從第二列 (i = 1) 開始，跳過第一列欄位標題
  for (let i = 1; i < lines.length; i++) {
    // 處理逗號分隔（相容欄位內雙引號狀況）
    let cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (cols.length >= 6) {
      let qText = cleanQuotes(cols[0]);
      let opt1 = cleanQuotes(cols[1]);
      let opt2 = cleanQuotes(cols[2]);
      let opt3 = cleanQuotes(cols[3]);
      let opt4 = cleanQuotes(cols[4]);
      let ans = parseInt(cleanQuotes(cols[5]));

      // 確保欄位皆有內容才加入題庫
      if (qText && opt1 && !isNaN(ans)) {
        rawQuestions.push({
          question: qText,
          options: [opt1, opt2, opt3, opt4],
          answer: ans
        });
      }
    }
  }
}

// 清除 CSV 欄位前後多餘的引號與空白
function cleanQuotes(str) {
  if (!str) return "";
  return str.trim().replace(/^"(.*)"$/, '$1');
}

// ==========================================
// 新一輪測驗初始化（洗牌並隨機抽取 10 題）
// ==========================================
function startNewQuizSession() {
  currentQ = 0;
  score = 0;
  isAnswered = false;
  selectedOption = -1;
  confetti = [];

  // 複製原始題庫陣列並進行 Fisher-Yates 隨機洗牌
  let shuffled = shuffleArray([...rawQuestions]);

  // 取洗牌後的前 10 題（若總題數少於 10 題則取全部）
  questions = shuffled.slice(0, min(10, shuffled.length));
}

// Fisher-Yates 洗牌演算法
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ==========================================
// p5.js draw 主要繪製迴圈
// ==========================================
function draw() {
  // 設定全螢幕背景底色 (#f4f1de)
  background('#f4f1de');

  // 1. 資料載入中畫面
  if (isLoading) {
    fill('#2b2d42');
    textFont(fontChinese);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("載入題庫中，請稍候...", width / 2, height / 2);
    return;
  }

  // 2. 載入失敗或無題目提示
  if (loadErrorMsg !== "" || questions.length === 0) {
    fill('#f94144');
    textFont(fontChinese);
    textSize(20);
    textAlign(CENTER, CENTER);
    let msg = loadErrorMsg !== "" ? loadErrorMsg : "試算表中未找到題目，請檢查格式。";
    text(msg, width / 2, height / 2);
    return;
  }

  // 3. 繪製測驗主畫面或結果結算畫面
  if (currentQ < questions.length) {
    drawQuizScreen();
  } else {
    drawEndScreen();
  }

  // 4. 更新並繪製答對時的彩帶粒子動畫
  updateAndDrawConfetti();
}

// ==========================================
// 繪製測驗題目畫面
// ==========================================
function drawQuizScreen() {
  let qData = questions[currentQ];

  // 響應式尺寸佈局計算
  let boxWidth = min(width * 0.85, 700);
  let boxX = (width - boxWidth) / 2;
  let headerY = height * 0.12;

  // --- 進度條與當前題號 ---
  fill('#3d405b');
  noStroke();
  textFont(fontEnglish);
  textSize(min(width * 0.04, 20));
  textAlign(CENTER, CENTER);
  text(`Question ${currentQ + 1} / ${questions.length}`, width / 2, headerY);

  // --- 題目內文（自動清除原本前綴題號，統一格式化為「1. 題目」） ---
  fill('#2b2d42');
  textFont(fontChinese);
  textSize(min(width * 0.045, 22));
  rectMode(CENTER);
  let cleanQuestionText = qData.question.replace(/^\d+[\.\s、]*/, '');
  let formattedQuestion = `${currentQ + 1}. ${cleanQuestionText}`;
  text(formattedQuestion, width / 2, headerY + 60, boxWidth, 100);
  rectMode(CORNER);

  // --- 繪製四個選項按鈕 ---
  let optionStartY = headerY + 140;
  let optionGap = 15;
  let optionHeight = max((height - optionStartY - 120) / 4 - optionGap, 50);

  for (let i = 0; i < 4; i++) {
    let optY = optionStartY + i * (optionHeight + optionGap);
    drawOptionButton(i, boxX, optY, boxWidth, optionHeight, qData.options[i]);
  }

  // --- 「下一題」按鈕（已回答後顯示） ---
  if (isAnswered) {
    let btnW = min(width * 0.4, 180);
    let btnH = 48;
    let btnX = (width - btnW) / 2;
    let btnY = height - 70;

    // 按鈕懸停 Hover 效果
    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      fill('#e07a5f');
    } else {
      fill('#f2cc8f');
    }

    stroke('#3d405b');
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 12);

    noStroke();
    fill('#3d405b');
    textFont(fontChinese);
    textSize(18);
    textAlign(CENTER, CENTER);
    text(currentQ === questions.length - 1 ? "查看結果" : "下一題", width / 2, btnY + btnH / 2);
  }
}

// ==========================================
// 繪製單一選項按鈕與動畫樣式
// ==========================================
function drawOptionButton(index, x, y, w, h, textStr) {
  let qData = questions[currentQ];
  let currentX = x;
  let currentY = y;
  let bgColor = color('#ffffff'); // 預設白色選項卡片
  let textColor = color('#2b2d42');

  if (isAnswered) {
    if (index === qData.answer) {
      // 正確答案：背景套用 #04a777
      bgColor = color('#04a777');
      textColor = color('#ffffff');

      // 答錯時，提示正確答案上下跳動
      if (selectedOption !== qData.answer) {
        bounceTime += 0.1;
        currentY += sin(bounceTime * 5) * 8;
      }
    } else if (index === selectedOption) {
      // 答錯選項：背景套用 #f94144
      bgColor = color('#f94144');
      textColor = color('#ffffff');

      // 選錯的選項左右搖晃
      shakeTime += 0.2;
      currentX += sin(shakeTime * 10) * 8;
    }
  } else {
    // 尚未回答時的滑鼠懸停 hover 效果
    if (mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h) {
      bgColor = color('#f4a261');
      textColor = color('#ffffff');
    }
  }

  // 繪製選項卡片
  stroke('#8d99ae');
  strokeWeight(1.5);
  fill(bgColor);
  rect(currentX, currentY, w, h, 10);

  // 選錯的選項繪製表面白色裂紋
  if (isAnswered && index === selectedOption && index !== qData.answer) {
    drawCracks(currentX, currentY, w, h);
  }

  // 繪製選項文字
  noStroke();
  fill(textColor);
  textFont(fontChinese);
  textSize(min(width * 0.038, 17));
  textAlign(LEFT, CENTER);
  text(textStr || "", currentX + 20, currentY + h / 2, w - 30);
}

// ==========================================
// 裂紋特效（選錯選項時產生）
// ==========================================
function generateCracks(w, h) {
  cracks = [];
  let centerX = w / 2;
  let centerY = h / 2;
  let numBranches = 5;

  for (let i = 0; i < numBranches; i++) {
    let angle = (TWO_PI / numBranches) * i + random(-0.3, 0.3);
    let path = [{ x: centerX, y: centerY }];
    let currX = centerX;
    let currY = centerY;
    let steps = floor(random(3, 6));

    for (let j = 0; j < steps; j++) {
      let len = random(10, 25);
      currX += cos(angle) * len + random(-5, 5);
      currY += sin(angle) * len + random(-5, 5);
      path.push({ x: currX, y: currY });
    }
    cracks.push(path);
  }
}

function drawCracks(bx, by, w, h) {
  stroke(255, 255, 255, 200);
  strokeWeight(2);
  noFill();

  push();
  translate(bx, by);
  for (let path of cracks) {
    beginShape();
    for (let pt of path) {
      vertex(pt.x, pt.y);
    }
    endShape();
  }
  pop();
}

// ==========================================
// 彩帶粒子特效（答對時產生）
// ==========================================
function spawnConfetti() {
  confetti = [];
  let colors = ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'];
  for (let i = 0; i < 80; i++) {
    confetti.push({
      x: random(width),
      y: random(-height * 0.5, 0),
      size: random(6, 12),
      color: color(random(colors)),
      vx: random(-2, 2),
      vy: random(3, 7),
      angle: random(TWO_PI),
      vAngle: random(-0.1, 0.1)
    });
  }
}

function updateAndDrawConfetti() {
  for (let i = confetti.length - 1; i >= 0; i--) {
    let p = confetti[i];
    p.x += p.vx;
    p.y += p.vy;
    p.angle += p.vAngle;

    push();
    translate(p.x, p.y);
    rotate(p.angle);
    noStroke();
    fill(p.color);
    rect(-p.size / 2, -p.size / 2, p.size, p.size);
    pop();

    if (p.y > height) {
      confetti.splice(i, 1);
    }
  }
}

// ==========================================
// 繪製測驗結束畫面
// ==========================================
function drawEndScreen() {
  fill('#2b2d42');
  textFont(fontChinese);
  textSize(min(width * 0.08, 36));
  textAlign(CENTER, CENTER);
  text("測驗完成！", width / 2, height * 0.3);

  textFont(fontEnglish);
  textSize(min(width * 0.06, 28));
  fill('#e07a5f');
  text(`Your Score: ${score} / ${questions.length}`, width / 2, height * 0.45);

  textFont(fontChinese);
  textSize(min(width * 0.045, 20));
  fill('#3d405b');
  let comment = score === questions.length ? "太棒了！答對全部題目！" : "做得好！可以再複習一下觀念喔！";
  text(comment, width / 2, height * 0.55);

  let btnW = min(width * 0.5, 200);
  let btnH = 50;
  let btnX = (width - btnW) / 2;
  let btnY = height * 0.68;

  if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
    fill('#81b29a');
  } else {
    fill('#3d405b');
  }

  rect(btnX, btnY, btnW, btnH, 12);

  fill('#ffffff');
  textSize(18);
  text("重新測驗", width / 2, btnY + btnH / 2);
}

// ==========================================
// 滑鼠點擊事件處理
// ==========================================
function mousePressed() {
  if (isLoading || questions.length === 0) return;

  if (currentQ < questions.length) {
    let boxWidth = min(width * 0.85, 700);
    let boxX = (width - boxWidth) / 2;
    let headerY = height * 0.12;
    let optionStartY = headerY + 140;
    let optionGap = 15;
    let optionHeight = max((height - optionStartY - 120) / 4 - optionGap, 50);

    if (!isAnswered) {
      for (let i = 0; i < 4; i++) {
        let optY = optionStartY + i * (optionHeight + optionGap);
        if (mouseX > boxX && mouseX < boxX + boxWidth && mouseY > optY && mouseY < optY + optionHeight) {
          selectedOption = i;
          isAnswered = true;

          if (i === questions[currentQ].answer) {
            // 答對：加分並噴發慶祝彩帶
            score++;
            spawnConfetti();
          } else {
            // 答錯：選錯選項搖晃、產生裂痕（不噴彩帶）
            shakeTime = 0;
            bounceTime = 0;
            generateCracks(boxWidth, optionHeight);
          }
          break;
        }
      }
    } else {
      let btnW = min(width * 0.4, 180);
      let btnH = 48;
      let btnX = (width - btnW) / 2;
      let btnY = height - 70;

      if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
        currentQ++;
        isAnswered = false;
        selectedOption = -1;
        confetti = [];
      }
    }
  } else {
    let btnW = min(width * 0.5, 200);
    let btnH = 50;
    let btnX = (width - btnW) / 2;
    let btnY = height * 0.68;

    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      // 點擊「重新測驗」時，重新洗牌抽題並重置狀態
      startNewQuizSession();
    }
  }
}

// ==========================================
// 響應式視窗調整
// ==========================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}