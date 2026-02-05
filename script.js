import { ref, set, get, onValue, update } 
from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

const db = window.firebaseDB;

let gameCode = "";
let playerId = "";
let gameRef = null;

document.getElementById("createBtn").onclick = createGame;
document.getElementById("joinBtn").onclick = joinGame;
document.getElementById("saveNameBtn").onclick = saveName;

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* יצירת משחק */
async function createGame() {
  gameCode = generateCode();
  playerId = "p1";
  gameRef = ref(db, "games/" + gameCode);

  await set(gameRef, {
    players: { p1: true },
    phase: "waiting"
  });

  document.getElementById("status").innerText =
    `קוד המשחק: ${gameCode}\nממתין לשחקן נוסף...`;

  listen();
}

/* הצטרפות */
async function joinGame() {
  const code = document.getElementById("codeInput").value.trim().toUpperCase();
  if (!code) return;

  gameCode = code;
  playerId = "p2";
  gameRef = ref(db, "games/" + gameCode);

  const snap = await get(gameRef);
  if (!snap.exists()) {
    alert("קוד לא קיים");
    return;
  }

  await update(gameRef, {
    "players/p2": true,
    phase: "names"
  });

  listen();
}

/* האזנה */
function listen() {
  onValue(gameRef, snap => {
    const data = snap.val();
    if (!data) return;

    if (data.phase === "waiting") {
      document.getElementById("status").innerText =
        `קוד המשחק: ${gameCode}\nממתין לשחקן נוסף...`;
    }

    if (data.phase === "names") showNameScreen(data);
    if (data.phase === "bombs") startBombPhase(data);
    if (data.phase === "play") startPlayPhase(data);
  });
}

/* שמות */
function showNameScreen(data) {
  document.getElementById("home").classList.add("hidden");
  document.getElementById("status").classList.add("hidden");
  document.getElementById("nameScreen").classList.remove("hidden");

  const names = data.names || {};
  if (names[playerId]) {
    document.getElementById("waitText").innerText =
      "ממתין לשחקן השני...";
  }
}

async function saveName() {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return;

  await update(gameRef, { [`names/${playerId}`]: name });

  const snap = await get(gameRef);
  const data = snap.val();

  if (data.names?.p1 && data.names?.p2) {
    await update(gameRef, {
      phase: "bombs",
      turn: "p1",
      hearts: { p1: 3, p2: 3 },
      chosenBombs: { p1: [], p2: [] },
      removed: []
    });
  }
}

/* יצירת לוח */
function drawBoard(clickHandler, removed = [], showOnly = null) {
  const board = document.getElementById("board");
  board.innerHTML = "";

  for (let i = 0; i < 18; i++) {
    if (removed.includes(i)) continue;

    const div = document.createElement("div");
    div.className = "circle";

    // אפשרות להראות רק חצי
    if (showOnly) {
      const isMyHalf = (playerId === "p1" && i < 9) || (playerId === "p2" && i >= 9);
      if (!isMyHalf) div.style.visibility = "hidden";
    }

    div.onclick = () => clickHandler(i, div);
    board.appendChild(div);
  }
}

/* שלב הפצצות */
function startBombPhase(data) {
  document.getElementById("nameScreen").classList.add("hidden");
  document.getElementById("board").classList.remove("hidden");

  const myTurn = data.turn === playerId;
  const enemy = playerId === "p1" ? "p2" : "p1";

  const names = data.names || {};
  document.getElementById("turnText").innerText =
    myTurn ? `${names[playerId]} - בחר 3 פצצות על הלוח שלך` :
             `תור היריב - ${names[enemy]}`;

  if (!myTurn) return;

  let chosen = data.chosenBombs?.[playerId] || [];
  const removed = data.removed || [];

  drawBoard(async (i, div) => {
    const isMyHalf = (playerId === "p1" && i < 9) || (playerId === "p2" && i >= 9);
    if (!isMyHalf) return; // רק הלוח שלך
    if (chosen.includes(i) || chosen.length >= 3) return;

    chosen.push(i);
    div.innerText = "💣"; // סמיילי פצצה
    div.style.cursor = "default";

    if (chosen.length === 3) {
      await update(gameRef, {
        [`chosenBombs/${playerId}`]: chosen,
        turn: enemy,
        phase: enemy === "p1" ? "bombs" : "play",
        removed: removed.concat(chosen)
      });
    }
  }, removed, true); // true = רק החצי שלך
}

/* שלב המשחק */
function startPlayPhase(data) {
  document.getElementById("hearts").classList.remove("hidden");

  const myTurn = data.turn === playerId;
  const enemy = playerId === "p1" ? "p2" : "p1";
  const names = data.names || {};

  document.getElementById("turnText").innerText =
    myTurn ? `${names[playerId]} - תורך` :
             `תור היריב - ${names[enemy]}`;

  document.getElementById("hearts").innerText =
    "❤️".repeat(data.hearts[playerId]);

  if (!myTurn) return;

  const removed = data.removed || [];
  drawBoard(async (i, div) => {
    const bombs = data.chosenBombs?.[enemy] || [];
    const isEnemyHalf = (playerId === "p1" && i >= 9) || (playerId === "p2" && i < 9);
    if (!isEnemyHalf) return; // רק לוח היריב

    let newHearts = data.hearts[playerId];
    let newRemoved = removed.concat(i);

    div.remove(); // עיגול נעלם אצל כולם

    if (bombs.includes(i)) {
      alert("BOOM!!!");
      newHearts--;
    } else {
      alert("SAVE!!!");
    }

    await update(gameRef, {
      [`hearts/${playerId}`]: newHearts,
      turn: enemy,
      removed: newRemoved
    });
  }, removed, false);
}
