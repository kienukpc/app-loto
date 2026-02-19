// ============================================================
// LÔ TÔ - CLIENT APP
// ============================================================
const socket = io();

// State
let state = {
  isHost: false,
  hostPlays: false,
  roomCode: "",
  tickets: [],
  markedNumbers: [],
  drawnNumbers: [],
  spinDuration: 3,
  isSpinning: false,
  musicPlaying: false,
  reminderEnabled: false,
};

// ============================================================
// DOM
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Screens
const screenHome = $("#screen-home");
const screenLobby = $("#screen-lobby");
const screenGame = $("#screen-game");

// Home
const hostNameInput = $("#host-name");
const playerNameInput = $("#player-name");
const btnShowCreate = $("#btn-show-create");
const createRoomForm = $("#create-room-form");
const btnCreate = $("#btn-create");
const hostPlaysCheckbox = $("#host-plays");
const roomEmpty = $("#room-empty");
const roomListItems = $("#room-list-items");

// Lobby
const lobbyRoomCode = $("#lobby-room-code");
const lobbyInfo = $("#lobby-info");
const lobbyNameInput = $("#lobby-name-input");
const btnChangeName = $("#btn-change-name");
const playerCount = $("#player-count");
const playerList = $("#player-list");
const lobbyHostActions = $("#lobby-host-actions");
const lobbyPlayerMsg = $("#lobby-player-msg");
const btnStart = $("#btn-start");

// Game
const gameRoomCode = $("#game-room-code");
const drawnCount = $("#drawn-count");
const overlaySpin = $("#overlay-spin");
const spinReel = $("#spin-reel");
const spinNumber = $("#spin-number");
const spinLabel = $("#spin-label");
const spinNearLotoBanner = $("#spin-near-loto");
const hostControls = $("#host-controls");
const btnDraw = $("#btn-draw");
const btnResetGame = $("#btn-reset-game");
const drawnList = $("#drawn-list");
const drawnTotal = $("#drawn-total");
const playerTickets = $("#player-tickets");
const ticketsScroll = $("#tickets-scroll");
const btnNearLoto = $("#btn-near-loto");
const btnToggleMusic = $("#btn-toggle-music");
const toggleReminder = $("#toggle-reminder");
const toggleAutoFill = $("#toggle-auto-fill");
const bgMusic = $("#bg-music");

// Overlays
const overlayNearLoto = $("#overlay-near-loto");
const nearLotoPlayer = $("#near-loto-player");
const nearLotoNumbers = $("#near-loto-numbers");
const btnCloseNearLoto = $("#btn-close-near-loto");
const overlayWinner = $("#overlay-winner");
const winnerGif = $("#winner-gif");
const winnerName = $("#winner-name");
const btnCloseWinner = $("#btn-close-winner");
const overlayBoard = $("#overlay-board");
const numberBoard = $("#number-board");
const btnNumberBoard = $("#btn-number-board");
const btnCloseBoard = $("#btn-close-board");
const overlayMenu = $("#overlay-menu");
const btnMenu = $("#btn-menu");
const btnLeave = $("#btn-leave");
const btnCloseMenu = $("#btn-close-menu");

// ============================================================
// SCREEN NAVIGATION
// ============================================================
function showScreen(screen) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  screen.classList.add("active");
}

// ============================================================
// MUSIC CONTROLS
// ============================================================
function startMusic() {
  bgMusic.volume = 0.4;
  bgMusic
    .play()
    .then(() => {
      state.musicPlaying = true;
      btnToggleMusic.textContent = "🔊";
    })
    .catch(() => {
      // Autoplay blocked – user needs to interact first
      state.musicPlaying = false;
      btnToggleMusic.textContent = "🔇";
    });
}

function stopMusic() {
  bgMusic.pause();
  state.musicPlaying = false;
  btnToggleMusic.textContent = "🔇";
}

btnToggleMusic.addEventListener("click", () => {
  if (state.musicPlaying) {
    stopMusic();
  } else {
    startMusic();
  }
});

// ============================================================
// REMINDER TOGGLE
// ============================================================
toggleReminder.addEventListener("change", () => {
  state.reminderEnabled = toggleReminder.checked;
  if (state.reminderEnabled) {
    showToast("🔔 Đã bật nhắc nhở khi ra số của bạn", "success");
  } else {
    showToast("🔕 Đã tắt nhắc nhở", "");
  }
});

// ============================================================
// AUTO FILL TOGGLE
// ============================================================
if (toggleAutoFill) {
  toggleAutoFill.addEventListener("change", () => {
    state.autoFillEnabled = toggleAutoFill.checked;
    if (state.autoFillEnabled) {
      showToast("⚡ Đã bật tự động đánh số", "success");
    } else {
      showToast("Đã tắt tự động đánh số", "");
    }
  });
}

// ============================================================
// HOME - CREATE ROOM TOGGLE
// ============================================================
btnShowCreate.addEventListener("click", () => {
  if (createRoomForm.style.display === "none") {
    createRoomForm.style.display = "block";
    btnShowCreate.textContent = "✕ Đóng";
    btnShowCreate.classList.add("btn-secondary");
    btnShowCreate.classList.remove("btn-primary");
  } else {
    createRoomForm.style.display = "none";
    btnShowCreate.textContent = "🏠 Tạo phòng mới";
    btnShowCreate.classList.remove("btn-secondary");
    btnShowCreate.classList.add("btn-primary");
  }
});

// ============================================================
// SELECTORS (Ticket count & Spin duration)
// ============================================================
let selectedTicketCount = 3;
let selectedSpinDuration = 3;

$$(".ticket-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".ticket-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedTicketCount = parseInt(btn.dataset.count);
  });
});

$$(".spin-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".spin-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedSpinDuration = parseInt(btn.dataset.spin);
  });
});

// ============================================================
// CREATE ROOM
// ============================================================
btnCreate.addEventListener("click", () => {
  const hostName = hostNameInput.value.trim() || "Host";
  socket.emit("create-room", {
    hostName,
    ticketsPerPlayer: selectedTicketCount,
    hostPlays: hostPlaysCheckbox.checked,
    spinDuration: selectedSpinDuration,
  });
});

socket.on(
  "room-created",
  ({ code, ticketsPerPlayer, hostPlays, spinDuration, tickets }) => {
    state.isHost = true;
    state.hostPlays = hostPlays;
    state.roomCode = code;
    state.spinDuration = spinDuration;

    if (hostPlays && tickets) {
      state.tickets = tickets;
      state.markedNumbers = tickets.map(() => new Set());
    }

    lobbyRoomCode.textContent = code;
    lobbyInfo.innerHTML =
      `${ticketsPerPlayer} vé/người · Quay ${spinDuration}s` +
      (hostPlays ? " · <strong>Host chơi</strong>" : "");
    lobbyHostActions.style.display = "block";
    lobbyPlayerMsg.style.display = "none";
    lobbyNameInput.value = hostNameInput.value.trim() || "Host";

    showScreen(screenLobby);
  },
);

// ============================================================
// ROOM BROWSER
// ============================================================
socket.on("room-list", ({ rooms }) => {
  renderRoomList(rooms);
});

function renderRoomList(rooms) {
  const waitingRooms = rooms.filter((r) => r.status === "waiting");

  if (waitingRooms.length === 0) {
    roomEmpty.style.display = "block";
    roomListItems.innerHTML = "";
    return;
  }

  roomEmpty.style.display = "none";
  roomListItems.innerHTML = waitingRooms
    .map(
      (r) => `
    <div class="room-item" data-code="${r.code}">
      <div class="room-item-left">
        <div class="room-item-code">${r.code}</div>
        <div class="room-item-info">
          <span>👑 ${r.hostName}</span>
          <span>👥 ${r.playerCount}</span>
          <span>🎫 ${r.ticketsPerPlayer} vé</span>
          <span>⏱ ${r.spinDuration}s</span>
        </div>
      </div>
      <div class="room-item-right">
        <span class="room-status waiting">Chờ</span>
        <span class="room-join-icon">→</span>
      </div>
    </div>
  `,
    )
    .join("");

  roomListItems.querySelectorAll(".room-item").forEach((item) => {
    item.addEventListener("click", () => {
      const code = item.dataset.code;
      const playerName = playerNameInput.value.trim() || "Player";
      socket.emit("join-room", { code, playerName });
    });
  });
}

// ============================================================
// JOIN ROOM (response)
// ============================================================
socket.on(
  "room-joined",
  ({ code, hostName, ticketsPerPlayer, spinDuration, tickets, players }) => {
    state.isHost = false;
    state.roomCode = code;
    state.spinDuration = spinDuration;
    state.tickets = tickets;
    state.markedNumbers = tickets.map(() => new Set());

    lobbyRoomCode.textContent = code;
    lobbyInfo.innerHTML = `${ticketsPerPlayer} vé/người · Host: ${hostName}`;
    lobbyHostActions.style.display = "none";
    lobbyPlayerMsg.style.display = "block";
    lobbyNameInput.value = playerNameInput.value.trim() || "Player";

    updatePlayerList(players);
    showScreen(screenLobby);
  },
);

// ============================================================
// LOBBY NAME CHANGE
// ============================================================
btnChangeName.addEventListener("click", () => {
  const newName = lobbyNameInput.value.trim();
  if (!newName) return;
  socket.emit("change-name", { newName });
  showToast(`✅ Đã đổi tên thành ${newName}`, "success");
});

// ============================================================
// PLAYER LIST
// ============================================================
socket.on("player-list-updated", ({ players }) => {
  updatePlayerList(players);
});

function updatePlayerList(players) {
  playerCount.textContent = players.length;
  playerList.innerHTML = players
    .map(
      (p) =>
        `<li class="${p.isHost ? "is-host" : ""}">${p.name}${p.isHost ? " (Host)" : ""}</li>`,
    )
    .join("");
}

// ============================================================
// START GAME
// ============================================================
btnStart.addEventListener("click", () => {
  socket.emit("start-game");
});

socket.on("game-started", () => {
  initGameScreen();
  showScreen(screenGame);
  startMusic();
});

// ============================================================
// DISBAND ROOM
// ============================================================
const btnDisband = $("#btn-disband");
if (btnDisband) {
  btnDisband.addEventListener("click", () => {
    socket.emit("disband-room");
    showToast("🚪 Đang giải tán phòng...", "error");
    setTimeout(() => location.reload(), 1500);
  });
}

// ============================================================
// GAME INIT
// ============================================================
function initGameScreen() {
  gameRoomCode.textContent = state.roomCode;
  drawnCount.textContent = "0";
  drawnTotal.textContent = "0";
  state.drawnNumbers = [];
  drawnList.innerHTML = "";

  if (state.isHost) {
    hostControls.style.display = "block";
    document
      .querySelector(".game-container")
      .classList.add("has-sticky-controls");
  } else {
    hostControls.style.display = "none";
    document
      .querySelector(".game-container")
      .classList.remove("has-sticky-controls");
  }

  if (state.tickets.length > 0) {
    playerTickets.style.display = "block";
    renderAllTickets();
  } else {
    playerTickets.style.display = "none";
  }
}

// ============================================================
// DRAW NUMBER
// ============================================================
btnDraw.addEventListener("click", () => {
  if (state.isSpinning) return;
  socket.emit("draw-number");
});

socket.on(
  "number-drawn",
  ({ number, drawnNumbers, remaining, spinDuration, dramaticSpin }) => {
    state.isSpinning = true;
    btnDraw.disabled = true;

    // Prepare spin overlay
    spinNumber.textContent = "?";
    spinLabel.textContent = "Đang quay...";
    spinLabel.classList.remove("highlight");
    spinReel.classList.remove("spinning", "revealing");

    // Show near-loto banner if dramatic
    if (dramaticSpin) {
      const names = dramaticSpin.playerNames.join(" & ");
      spinNearLotoBanner.textContent = `⚠️ ${names} sắp LÔ TÔ! Hàng ${dramaticSpin.sharedTens}x`;
      spinNearLotoBanner.style.display = "block";
    } else {
      spinNearLotoBanner.style.display = "none";
    }

    overlaySpin.style.display = "flex";

    if (dramaticSpin) {
      // === DRAMATIC TWO-PHASE SPIN ===
      const tens = dramaticSpin.sharedTens;

      // Phase 1: Quick spin, reveal tens digit
      spinReel.classList.add("spinning");
      const shuffle1 = setInterval(() => {
        spinNumber.textContent = Math.floor(Math.random() * 90) + 1;
      }, 80);

      setTimeout(
        () => {
          clearInterval(shuffle1);
          spinReel.classList.remove("spinning");
          spinNumber.textContent = tens > 0 ? tens + "_" : "0_";
          spinLabel.textContent = `Chữ số đầu: ${tens}...`;

          // Phase 2: Slow dramatic spin for units digit after 1s pause
          setTimeout(() => {
            spinReel.classList.add("spinning");
            const shuffle2 = setInterval(() => {
              const randUnit = Math.floor(Math.random() * 10);
              spinNumber.textContent =
                tens > 0 ? tens + "" + randUnit : "0" + randUnit;
            }, 200);

            // Final reveal after 5 seconds
            setTimeout(() => {
              clearInterval(shuffle2);
              spinReel.classList.remove("spinning");
              spinReel.classList.add("revealing");
              spinNumber.textContent = number;
              spinLabel.textContent = `Số ${number}!`;
              spinLabel.classList.add("highlight");

              setTimeout(() => {
                overlaySpin.style.display = "none";
                spinReel.classList.remove("revealing");
                spinNearLotoBanner.style.display = "none";
                updateAfterDraw(number, drawnNumbers);
              }, 1200);
            }, 5000);
          }, 1000);
        },
        Math.max(spinDuration * 500, 1000),
      );
    } else {
      // === NORMAL SPIN ===
      spinReel.classList.add("spinning");
      const shuffleInterval = setInterval(() => {
        spinNumber.textContent = Math.floor(Math.random() * 90) + 1;
      }, 80);

      setTimeout(() => {
        clearInterval(shuffleInterval);
        spinReel.classList.remove("spinning");
        spinReel.classList.add("revealing");
        spinNumber.textContent = number;
        spinLabel.textContent = `Số ${number}!`;
        spinLabel.classList.add("highlight");

        setTimeout(() => {
          overlaySpin.style.display = "none";
          spinReel.classList.remove("revealing");
          updateAfterDraw(number, drawnNumbers);
        }, 1000);
      }, spinDuration * 1000);
    }
  },
);

function updateAfterDraw(number, drawnNumbers) {
  state.drawnNumbers = drawnNumbers;
  state.isSpinning = false;
  if (state.isHost) btnDraw.disabled = false;

  drawnCount.textContent = drawnNumbers.length;
  drawnTotal.textContent = drawnNumbers.length;

  const chip = document.createElement("span");
  chip.className = "drawn-chip";
  chip.textContent = number;
  drawnList.appendChild(chip);

  // AUTO FILL LOGIC
  if (state.autoFillEnabled && state.tickets.length > 0) {
    state.tickets.forEach((ticket, tIdx) => {
      let hasNumber = false;
      for (let r = 0; r < 3; r++) {
        if (ticket[r].includes(number)) hasNumber = true;
      }

      if (hasNumber) {
        const marked = state.markedNumbers[tIdx];
        if (!marked.has(number)) {
          toggleNumber(tIdx, number);
          showToast(`⚡ Auto: Đã đánh số ${number}`, "success");
        }
      }
    });
  }

  // Check if drawn number is on player's ticket AND not marked → miss reminder
  if (state.tickets.length > 0 && state.reminderEnabled) {
    // Check for missed numbers from PREVIOUS draws (not current one)
    const previousDrawn = drawnNumbers.slice(0, -1);
    let missedNumbers = [];
    state.tickets.forEach((ticket, tIdx) => {
      const marked = state.markedNumbers[tIdx];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
          const n = ticket[row][col];
          if (n !== 0 && previousDrawn.includes(n) && !marked.has(n)) {
            if (!missedNumbers.includes(n)) {
              missedNumbers.push(n);
            }
          }
        }
      }
    });

    if (missedNumbers.length > 0) {
      showToast(
        `⚠️ Sót số: ${missedNumbers.join(", ")} kìa, lêu lêu!`,
        "warning",
      );
    }

    // Also notify about current number being on their ticket
    let currentOnTicket = false;
    state.tickets.forEach((ticket) => {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
          if (ticket[row][col] === number) {
            currentOnTicket = true;
          }
        }
      }
    });
    if (currentOnTicket) {
      showToast(`🔔 Số ${number} có trong vé của bạn!`, "success");
    }
  }

  // Always re-render to update "is-drawn" styles
  renderAllTickets();

  // Auto-Win Check (catch cases where user pre-marked the winning number)
  const drawnSet = new Set(state.drawnNumbers);
  for (let tIdx = 0; tIdx < state.tickets.length; tIdx++) {
    const ticket = state.tickets[tIdx];
    const tMarked = state.markedNumbers[tIdx];
    for (let row = 0; row < 3; row++) {
      const numbersInRow = ticket[row].filter((n) => n !== 0);
      if (numbersInRow.length === 0) continue;
      const allComplete = numbersInRow.every(
        (n) => drawnSet.has(n) && tMarked.has(n),
      );
      if (allComplete) {
        socket.emit("claim-loto", { ticketIndex: tIdx });
        return; // Only claim once
      }
    }
  }
}

// ============================================================
// TICKET RENDERING
// ============================================================
function renderAllTickets() {
  ticketsScroll.innerHTML = "";

  state.tickets.forEach((ticket, ticketIdx) => {
    const card = document.createElement("div");
    card.className = "ticket-card";

    if (state.tickets.length > 1) {
      const label = document.createElement("div");
      label.className = "ticket-label";
      label.textContent = `🎫 Vé ${ticketIdx + 1}`;
      card.appendChild(label);
    }

    const ticketEl = document.createElement("div");
    ticketEl.className = "ticket";

    const grid = document.createElement("div");
    grid.className = "ticket-grid";

    const marked = state.markedNumbers[ticketIdx];
    const drawnSet = new Set(state.drawnNumbers);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        const num = ticket[row][col];
        const cell = document.createElement("div");
        cell.className = "ticket-cell";

        if (num !== 0) {
          cell.classList.add("has-number");
          cell.textContent = num;

          if (drawnSet.has(num)) {
            cell.classList.add("is-drawn");
          }

          if (marked.has(num)) {
            cell.classList.add("marked");
          }

          cell.addEventListener("click", () => {
            toggleNumber(ticketIdx, num);
          });
        } else {
          cell.classList.add("empty");
        }

        grid.appendChild(cell);
      }
    }

    ticketEl.appendChild(grid);
    card.appendChild(ticketEl);
    ticketsScroll.appendChild(card);
  });
}

function toggleNumber(ticketIndex, number) {
  const marked = state.markedNumbers[ticketIndex];
  if (marked.has(number)) {
    marked.delete(number);
  } else {
    marked.add(number);
  }

  socket.emit("toggle-number", { ticketIndex, number });
  renderAllTickets();

  // Auto-win check: if any row in any ticket has all numbers drawn AND marked → claim loto
  const drawnSet = new Set(state.drawnNumbers);
  for (let tIdx = 0; tIdx < state.tickets.length; tIdx++) {
    const ticket = state.tickets[tIdx];
    const tMarked = state.markedNumbers[tIdx];
    for (let row = 0; row < 3; row++) {
      const numbersInRow = ticket[row].filter((n) => n !== 0);
      if (numbersInRow.length === 0) continue;
      const allComplete = numbersInRow.every(
        (n) => drawnSet.has(n) && tMarked.has(n),
      );
      if (allComplete) {
        socket.emit("claim-loto", { ticketIndex: tIdx });
        return; // Only claim once
      }
    }
  }
}

// ============================================================
// NUMBER BOARD (Host)
// ============================================================
btnNumberBoard.addEventListener("click", () => {
  renderNumberBoard();
  overlayBoard.style.display = "flex";
});

btnCloseBoard.addEventListener("click", () => {
  overlayBoard.style.display = "none";
});

function renderNumberBoard() {
  numberBoard.innerHTML = "";
  const drawnSet = new Set(state.drawnNumbers);
  const lastDrawn =
    state.drawnNumbers.length > 0
      ? state.drawnNumbers[state.drawnNumbers.length - 1]
      : -1;

  for (let i = 1; i <= 90; i++) {
    const cell = document.createElement("div");
    cell.className = "board-cell";
    cell.textContent = i;
    if (drawnSet.has(i)) {
      cell.classList.add("drawn");
      if (i === lastDrawn) cell.classList.add("last-drawn");
    }
    numberBoard.appendChild(cell);
  }
}

// ============================================================
// NEAR LOTO (Player declares)
// ============================================================
btnNearLoto.addEventListener("click", () => {
  if (state.tickets.length === 0) return;

  const drawnSet = new Set(state.drawnNumbers);
  let bestRow = null;

  state.tickets.forEach((ticket, tIdx) => {
    ticket.forEach((row, rIdx) => {
      const numbersInRow = row.filter((n) => n !== 0);
      const missing = numbersInRow.filter((n) => !drawnSet.has(n));
      if (missing.length >= 1 && missing.length <= 3) {
        if (!bestRow || missing.length < bestRow.missing.length) {
          bestRow = { ticketIndex: tIdx, rowIndex: rIdx, missing };
        }
      }
    });
  });

  if (!bestRow) {
    showToast("❌ Chưa có hàng nào sắp xong (cần còn tối đa 3 số)", "error");
    return;
  }

  socket.emit("declare-near-loto", {
    ticketIndex: bestRow.ticketIndex,
    rowIndex: bestRow.rowIndex,
  });

  showToast(`⚠️ Đã báo sắp Lô Tô! Còn ${bestRow.missing.length} số`, "warning");
});

socket.on("near-loto-declared", ({ playerName, missingNumbers }) => {
  nearLotoPlayer.textContent = playerName;
  nearLotoNumbers.innerHTML = missingNumbers
    .map((n) => `<div class="near-loto-num">${n}</div>`)
    .join("");
  overlayNearLoto.style.display = "flex";

  setTimeout(() => {
    overlayNearLoto.style.display = "none";
  }, 4000);
});

btnCloseNearLoto.addEventListener("click", () => {
  overlayNearLoto.style.display = "none";
});

// Near-loto nudge: server detected player has 1 number left but didn't declare
socket.on("near-loto-nudge", ({ playerName, missingNumber }) => {
  showToast(
    `Ê ${playerName} thiếu số ${missingNumber} sắp lô tô mà không báo kìa!`,
    "warning",
  );
});

// ============================================================
// GAME WON (winner celebration)
// ============================================================
const celebrationGifs = ["/gif/giphy.gif", "/gif/giphy (1).gif"];

socket.on("game-won", ({ playerName }) => {
  const gif =
    celebrationGifs[Math.floor(Math.random() * celebrationGifs.length)];
  winnerGif.src = gif;
  winnerName.textContent = playerName;
  overlayWinner.style.display = "flex";
  btnDraw.disabled = true;
  stopMusic();
});

btnCloseWinner.addEventListener("click", () => {
  overlayWinner.style.display = "none";
});

// ============================================================
// RESET GAME (back to lobby)
// ============================================================
btnResetGame.addEventListener("click", () => {
  socket.emit("reset-game");
  showToast("🔄 Đang tạo ván mới...", "success");
});

socket.on("back-to-lobby", ({ code, players }) => {
  state.drawnNumbers = [];
  overlayWinner.style.display = "none";
  btnDraw.disabled = false;
  stopMusic();

  // Reset UI for lobby
  lobbyRoomCode.textContent = code;
  if (state.isHost) {
    lobbyHostActions.style.display = "block";
    lobbyPlayerMsg.style.display = "none";
  } else {
    lobbyHostActions.style.display = "none";
    lobbyPlayerMsg.style.display = "block";
  }

  updatePlayerList(players);
  showScreen(screenLobby);
  showToast("🔄 Ván mới! Chờ trong phòng chờ...", "success");
});

socket.on("tickets-refreshed", ({ tickets }) => {
  state.tickets = tickets;
  state.markedNumbers = tickets.map(() => new Set());
});

// ============================================================
// GAME FINISHED
// ============================================================
socket.on("game-finished", ({ message }) => {
  showToast(message || "Kết thúc!");
});

// ============================================================
// MENU
// ============================================================
btnMenu.addEventListener("click", () => {
  overlayMenu.style.display = "flex";
});

btnCloseMenu.addEventListener("click", () => {
  overlayMenu.style.display = "none";
});

btnLeave.addEventListener("click", () => {
  location.reload();
});

// ============================================================
// ERROR & EVENTS
// ============================================================
socket.on("error-msg", ({ message }) => {
  showToast(message, "error");
});

socket.on("room-closed", ({ message }) => {
  showToast(message, "error");
  stopMusic();
  setTimeout(() => location.reload(), 2000);
});

socket.on("player-left", ({ playerName }) => {
  showToast(`${playerName} đã rời phòng`, "error");
});

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = "") {
  const container = $("#toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// MISC
// ============================================================
document.addEventListener(
  "dblclick",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);
