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
const btnCreate = $("#btn-create");
const hostPlaysCheckbox = $("#host-plays");
const roomBrowser = $("#room-browser");
const roomEmpty = $("#room-empty");
const roomListItems = $("#room-list-items");

// Lobby
const lobbyRoomCode = $("#lobby-room-code");
const lobbyInfo = $("#lobby-info");
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
const hostControls = $("#host-controls");
const btnDraw = $("#btn-draw");
const btnResetGame = $("#btn-reset-game");
const drawnList = $("#drawn-list");
const drawnTotal = $("#drawn-total");
const playerTickets = $("#player-tickets");
const ticketsScroll = $("#tickets-scroll");
const btnClaim = $("#btn-claim");

// Overlays
const overlayLoto = $("#overlay-loto");
const lotoPlayerName = $("#loto-player-name");
const btnCloseLoto = $("#btn-close-loto");
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
  // Filter to only waiting rooms
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

  // Add click handlers
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

    updatePlayerList(players);
    showScreen(screenLobby);
  },
);

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
});

// ============================================================
// GAME INIT
// ============================================================
function initGameScreen() {
  gameRoomCode.textContent = state.roomCode;
  drawnCount.textContent = "0";
  drawnTotal.textContent = "0";
  state.drawnNumbers = [];
  drawnList.innerHTML = "";

  // Show host controls
  if (state.isHost) {
    hostControls.style.display = "block";
    // Add padding to game container for sticky bar
    document
      .querySelector(".game-container")
      .classList.add("has-sticky-controls");
  } else {
    hostControls.style.display = "none";
    document
      .querySelector(".game-container")
      .classList.remove("has-sticky-controls");
  }

  // Show tickets if player, or if host plays
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
  ({ number, drawnNumbers, remaining, spinDuration }) => {
    state.drawnNumbers = drawnNumbers;
    state.isSpinning = true;

    // Disable draw button during spin
    btnDraw.disabled = true;

    // Show spin overlay popup for ALL clients
    spinNumber.textContent = "?";
    spinLabel.textContent = "Đang quay...";
    spinLabel.classList.remove("highlight");
    spinReel.classList.remove("spinning", "revealing");
    overlaySpin.style.display = "flex";

    // Start spin animation
    spinReel.classList.add("spinning");

    // Shuffle random numbers while spinning
    const shuffleInterval = setInterval(() => {
      spinNumber.textContent = Math.floor(Math.random() * 90) + 1;
    }, 80);

    // After spin duration, reveal the real number
    setTimeout(() => {
      clearInterval(shuffleInterval);
      spinReel.classList.remove("spinning");
      spinReel.classList.add("revealing");
      spinNumber.textContent = number;
      spinLabel.textContent = `Số ${number}!`;
      spinLabel.classList.add("highlight");

      // After reveal animation, close overlay and update drawn list
      setTimeout(() => {
        overlaySpin.style.display = "none";
        spinReel.classList.remove("revealing");

        // Update counter
        drawnCount.textContent = drawnNumbers.length;
        drawnTotal.textContent = drawnNumbers.length;

        // Add chip to drawn list
        const chip = document.createElement("span");
        chip.className = "drawn-chip";
        chip.textContent = number;
        drawnList.appendChild(chip);

        // Update tickets
        if (state.tickets.length > 0) {
          renderAllTickets();
        }

        state.isSpinning = false;
        btnDraw.disabled = false;
      }, 1000);
    }, spinDuration * 1000);
  },
);

// ============================================================
// TICKET RENDERING (scrollable, all tickets visible)
// ============================================================
function renderAllTickets() {
  ticketsScroll.innerHTML = "";

  state.tickets.forEach((ticket, ticketIdx) => {
    const card = document.createElement("div");
    card.className = "ticket-card";

    // Label
    if (state.tickets.length > 1) {
      const label = document.createElement("div");
      label.className = "ticket-label";
      label.textContent = `🎫 Vé ${ticketIdx + 1}`;
      card.appendChild(label);
    }

    // Ticket
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
// CLAIM LOTO
// ============================================================
btnClaim.addEventListener("click", () => {
  socket.emit("claim-loto", { ticketIndex: 0 });
});

socket.on("loto-claimed", ({ playerName }) => {
  lotoPlayerName.textContent = playerName;
  overlayLoto.style.display = "flex";
});

btnCloseLoto.addEventListener("click", () => {
  overlayLoto.style.display = "none";
});

// ============================================================
// RESET GAME
// ============================================================
btnResetGame.addEventListener("click", () => {
  if (confirm("Bắt đầu ván mới? Vé mới sẽ được phát.")) {
    socket.emit("reset-game");
  }
});

socket.on("game-reset", () => {
  state.drawnNumbers = [];
  drawnCount.textContent = "0";
  drawnTotal.textContent = "0";
  drawnList.innerHTML = "";

  if (state.tickets.length > 0) {
    renderAllTickets();
  }

  showToast("🔄 Ván mới!", "success");
});

socket.on("tickets-refreshed", ({ tickets }) => {
  state.tickets = tickets;
  state.markedNumbers = tickets.map(() => new Set());
  renderAllTickets();
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
