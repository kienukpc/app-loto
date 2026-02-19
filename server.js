const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// GAME STATE
// ============================================================
const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

// ============================================================
// TICKET GENERATION (unique numbers across all tickets for same player)
// Generates `count` tickets at once, ensuring no duplicate numbers
// ============================================================
function generateTickets(count) {
  // Column ranges: col 0 = 1-9, col 1 = 10-19, ..., col 8 = 80-90
  const colRanges = [
    [1, 9],
    [10, 19],
    [20, 29],
    [30, 39],
    [40, 49],
    [50, 59],
    [60, 69],
    [70, 79],
    [80, 90],
  ];

  // Create ONE shared shuffled pool per column for all tickets (unique numbers)
  const colPools = colRanges.map(([min, max]) => {
    const nums = [];
    for (let i = min; i <= max; i++) nums.push(i);
    return shuffle(nums);
  });

  const tickets = [];
  for (let t = 0; t < count; t++) {
    const grid = generateOneTicket(colPools);
    tickets.push(grid);
  }

  return tickets;
}

function generateOneTicket(colPools) {
  // Each ticket: 3 rows x 9 cols, each row has exactly 5 numbers, each col has 1-3 numbers
  // Total: 15 numbers, distributed across 9 columns

  // Step 1: Determine how many numbers each column gets (1, 2, or 3)
  // Total must be 15 (5 per row × 3 rows), distributed across 9 columns
  // Each column must have at least 1 number (9 minimum), remaining 6 distributed
  const colCounts = Array(9).fill(1); // Start with 1 per column = 9
  let remaining = 6; // Need 6 more to reach 15

  // Distribute remaining, max 3 per column
  const colOrder = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  let idx = 0;
  while (remaining > 0) {
    const col = colOrder[idx % 9];
    if (colCounts[col] < 3) {
      colCounts[col]++;
      remaining--;
    }
    idx++;
    if (idx > 50) break; // Safety
  }

  // Step 2: Assign which rows each column's numbers go to
  // Each row must end up with exactly 5 numbers
  const rowCounts = [0, 0, 0];
  const colRows = Array.from({ length: 9 }, () => []);

  // Sort columns by count (descending) to place harder constraints first
  const colsByCount = [...Array(9).keys()].sort(
    (a, b) => colCounts[b] - colCounts[a],
  );

  for (const col of colsByCount) {
    const needed = colCounts[col];
    if (needed === 3) {
      colRows[col] = [0, 1, 2];
      rowCounts[0]++;
      rowCounts[1]++;
      rowCounts[2]++;
    } else if (needed === 2) {
      // Pick 2 rows with lowest counts
      const sorted = [0, 1, 2].sort((a, b) => rowCounts[a] - rowCounts[b]);
      const picked = sorted.slice(0, 2).sort();
      colRows[col] = picked;
      picked.forEach((r) => rowCounts[r]++);
    } else {
      // Pick row with lowest count
      const sorted = [0, 1, 2].sort((a, b) => rowCounts[a] - rowCounts[b]);
      colRows[col] = [sorted[0]];
      rowCounts[sorted[0]]++;
    }
  }

  // Step 3: Fill grid with numbers from pools
  const grid = Array.from({ length: 3 }, () => Array(9).fill(0));

  for (let col = 0; col < 9; col++) {
    const rows = colRows[col];
    const nums = [];
    for (let i = 0; i < rows.length; i++) {
      if (colPools[col].length > 0) {
        nums.push(colPools[col].pop());
      }
    }
    nums.sort((a, b) => a - b); // Sort ascending within column
    for (let i = 0; i < nums.length; i++) {
      grid[rows[i]][col] = nums[i];
    }
  }

  return grid;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// SOCKET.IO
// ============================================================
// ============================================================
// ROOM LIST BROADCAST
// ============================================================
function getRoomList() {
  const list = [];
  for (const [code, room] of rooms) {
    list.push({
      code,
      hostName: room.hostName,
      playerCount: room.players.size,
      ticketsPerPlayer: room.ticketsPerPlayer,
      spinDuration: room.spinDuration,
      hostPlays: room.hostPlays,
      status: room.status,
    });
  }
  return list;
}

function broadcastRoomList() {
  io.emit("room-list", { rooms: getRoomList() });
}

io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Send room list on connect
  socket.emit("room-list", { rooms: getRoomList() });

  // Client can request room list refresh
  socket.on("get-rooms", () => {
    socket.emit("room-list", { rooms: getRoomList() });
  });

  // ----------------------------------------------------------
  // CREATE ROOM
  // ----------------------------------------------------------
  socket.on(
    "create-room",
    ({ hostName, ticketsPerPlayer, hostPlays, spinDuration }) => {
      const code = generateRoomCode();
      const room = {
        code,
        hostId: socket.id,
        hostName: hostName || "Host",
        ticketsPerPlayer: Math.min(
          Math.max(parseInt(ticketsPerPlayer) || 1, 1),
          5,
        ),
        hostPlays: !!hostPlays,
        spinDuration: Math.min(Math.max(parseFloat(spinDuration) || 3, 1), 10),
        players: new Map(),
        drawnNumbers: [],
        nearLotoPlayers: new Map(), // playerId -> { playerName, missingNumbers: [num,...] }
        status: "waiting",
      };

      // If host plays, generate tickets for host too
      if (room.hostPlays) {
        const tickets = generateTickets(room.ticketsPerPlayer);
        room.players.set(socket.id, {
          id: socket.id,
          name: hostName || "Host",
          tickets,
          markedNumbers: Array.from(
            { length: room.ticketsPerPlayer },
            () => new Set(),
          ),
          isHost: true,
        });
      }

      rooms.set(code, room);
      socket.join(code);
      socket.roomCode = code;
      socket.playerName = hostName || "Host";
      socket.isHost = true;

      console.log(
        `[Room] ${code} created by ${hostName} (hostPlays=${room.hostPlays}, spin=${room.spinDuration}s)`,
      );

      const response = {
        code,
        ticketsPerPlayer: room.ticketsPerPlayer,
        hostPlays: room.hostPlays,
        spinDuration: room.spinDuration,
      };

      if (room.hostPlays) {
        response.tickets = room.players.get(socket.id).tickets;
      }

      socket.emit("room-created", response);
      broadcastRoomList();
    },
  );

  // ----------------------------------------------------------
  // JOIN ROOM
  // ----------------------------------------------------------
  socket.on("join-room", ({ code, playerName }) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms.get(roomCode);

    if (!room) {
      return socket.emit("error-msg", { message: "Không tìm thấy phòng!" });
    }
    if (room.status !== "waiting") {
      return socket.emit("error-msg", { message: "Trò chơi đã bắt đầu!" });
    }

    const tickets = generateTickets(room.ticketsPerPlayer);

    const player = {
      id: socket.id,
      name: playerName || "Player",
      tickets,
      markedNumbers: Array.from(
        { length: room.ticketsPerPlayer },
        () => new Set(),
      ),
      isHost: false,
    };

    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerName = playerName || "Player";
    socket.isHost = false;

    console.log(
      `[Room ${roomCode}] ${playerName} joined (${room.players.size} players)`,
    );

    socket.emit("room-joined", {
      code: roomCode,
      hostName: room.hostName,
      ticketsPerPlayer: room.ticketsPerPlayer,
      spinDuration: room.spinDuration,
      tickets,
      players: getPlayerList(room),
    });

    io.to(roomCode).emit("player-list-updated", {
      players: getPlayerList(room),
    });

    broadcastRoomList();
  });

  // ----------------------------------------------------------
  // START GAME
  // ----------------------------------------------------------
  socket.on("start-game", () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;

    const nonHostPlayers = Array.from(room.players.values()).filter(
      (p) => !p.isHost,
    );
    if (nonHostPlayers.length === 0 && !room.hostPlays) {
      return socket.emit("error-msg", { message: "Cần ít nhất 1 người chơi!" });
    }

    room.status = "playing";
    console.log(`[Room ${room.code}] Game started!`);
    io.to(room.code).emit("game-started");
    broadcastRoomList();
  });

  // ----------------------------------------------------------
  // DRAW NUMBER
  // ----------------------------------------------------------
  socket.on("draw-number", () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;
    if (room.status !== "playing") return;

    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    const available = allNumbers.filter((n) => !room.drawnNumbers.includes(n));

    if (available.length === 0) {
      room.status = "finished";
      io.to(room.code).emit("game-finished", { message: "Đã hết số!" });
      return;
    }

    const drawn = available[Math.floor(Math.random() * available.length)];
    room.drawnNumbers.push(drawn);

    console.log(
      `[Room ${room.code}] Drew: ${drawn} (${room.drawnNumbers.length}/90)`,
    );

    // Check for dramatic spin: 2+ players with exactly 1 missing number, and drawn number matches one of them
    let dramaticSpin = null;
    const singleMissingPlayers = [];
    for (const [pid, info] of room.nearLotoPlayers) {
      if (info.missingNumbers.length === 1) {
        singleMissingPlayers.push(info);
      }
    }

    if (singleMissingPlayers.length >= 2) {
      // Check if any of these single-number players have numbers sharing the same tens digit
      const matchingPlayers = singleMissingPlayers.filter((p) => {
        const tens = Math.floor(p.missingNumbers[0] / 10);
        return Math.floor(drawn / 10) === tens;
      });

      if (matchingPlayers.length >= 2) {
        const sharedTens = Math.floor(drawn / 10);
        const playerNames = matchingPlayers.map((p) => p.playerName);
        dramaticSpin = { sharedTens, playerNames };

        // Remove matched player from near-loto
        for (const [pid, info] of room.nearLotoPlayers) {
          if (info.missingNumbers.includes(drawn)) {
            room.nearLotoPlayers.delete(pid);
            break;
          }
        }
      }
    }

    io.to(room.code).emit("number-drawn", {
      number: drawn,
      drawnNumbers: room.drawnNumbers,
      remaining: available.length - 1,
      spinDuration: room.spinDuration,
      dramaticSpin, // null or { sharedTens, playerNames }
    });

    // Auto-detect undeclared near-loto: players with a row missing exactly 1 number
    const drawnSet = new Set(room.drawnNumbers);
    for (const [pid, player] of room.players) {
      if (room.nearLotoPlayers.has(pid)) continue; // already declared
      for (const ticket of player.tickets) {
        for (const row of ticket) {
          const numbersInRow = row.filter((n) => n !== 0);
          const missing = numbersInRow.filter((n) => !drawnSet.has(n));
          if (missing.length === 1) {
            // This player has 1 number left but hasn't declared!
            io.to(room.code).emit("near-loto-nudge", {
              playerName: player.name,
              missingNumber: missing[0],
            });
            break; // one nudge per player per draw
          }
        }
      }
    }
  });

  // ----------------------------------------------------------
  // CHANGE NAME (in lobby)
  // ----------------------------------------------------------
  socket.on("change-name", ({ newName }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (room.status !== "waiting") return;

    const name = (newName || "").trim().slice(0, 20) || "Player";
    const player = room.players.get(socket.id);
    if (player) {
      player.name = name;
    }
    socket.playerName = name;
    if (socket.isHost) {
      room.hostName = name;
    }

    console.log(`[Room ${room.code}] ${socket.id} changed name to ${name}`);

    io.to(room.code).emit("player-list-updated", {
      players: getPlayerList(room),
    });
    broadcastRoomList();
  });

  // ----------------------------------------------------------
  // TOGGLE NUMBER
  // ----------------------------------------------------------
  socket.on("toggle-number", ({ ticketIndex, number }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    const marked = player.markedNumbers[ticketIndex];
    if (!marked) return;

    if (marked.has(number)) {
      marked.delete(number);
    } else {
      marked.add(number);
    }
  });

  // ----------------------------------------------------------
  // CLAIM LOTO
  // ----------------------------------------------------------
  socket.on("claim-loto", ({ ticketIndex }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    console.log(
      `[Room ${room.code}] 🎉 ${player.name} hô LÔ TÔ! (vé #${ticketIndex + 1})`,
    );

    room.status = "finished";

    io.to(room.code).emit("game-won", {
      playerName: player.name,
      ticketIndex,
    });

    broadcastRoomList();
  });

  // ----------------------------------------------------------
  // RESET GAME (back to lobby)
  // ----------------------------------------------------------
  socket.on("reset-game", () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;

    room.drawnNumbers = [];
    room.status = "waiting";
    room.nearLotoPlayers = new Map();

    for (const [id, player] of room.players) {
      const tickets = generateTickets(room.ticketsPerPlayer);
      player.tickets = tickets;
      player.markedNumbers = Array.from(
        { length: room.ticketsPerPlayer },
        () => new Set(),
      );
      io.to(id).emit("tickets-refreshed", { tickets });
    }

    io.to(room.code).emit("back-to-lobby", {
      code: room.code,
      players: getPlayerList(room),
    });
    console.log(`[Room ${room.code}] Back to lobby!`);
    broadcastRoomList();
  });

  // ----------------------------------------------------------
  // DECLARE NEAR LOTO
  // ----------------------------------------------------------
  socket.on("declare-near-loto", ({ ticketIndex, rowIndex }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    if (room.status !== "playing") return;

    // Find missing numbers for the specified row
    const ticket = player.tickets[ticketIndex];
    if (!ticket) return;
    const row = ticket[rowIndex];
    if (!row) return;

    const drawnSet = new Set(room.drawnNumbers);
    const numbersInRow = row.filter((n) => n !== 0);
    const missingNumbers = numbersInRow.filter((n) => !drawnSet.has(n));

    if (missingNumbers.length === 0 || missingNumbers.length > 3) return;

    // Store the near-loto declaration
    room.nearLotoPlayers.set(socket.id, {
      playerName: player.name,
      missingNumbers,
      ticketIndex,
      rowIndex,
    });

    console.log(
      `[Room ${room.code}] ⚠️ ${player.name} sắp lô tô! Còn: ${missingNumbers.join(", ")}`,
    );

    // Broadcast to all clients
    io.to(room.code).emit("near-loto-declared", {
      playerName: player.name,
      missingNumbers,
      ticketIndex: ticketIndex + 1,
    });
  });

  // ----------------------------------------------------------
  // DISBAND ROOM (host dissolves the room)
  // ----------------------------------------------------------
  socket.on("disband-room", () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;

    console.log(`[Room ${room.code}] Disbanded by host`);
    io.to(room.code).emit("room-closed", {
      message: "Host đã giải tán phòng!",
    });
    rooms.delete(room.code);
    broadcastRoomList();
  });

  // ----------------------------------------------------------
  // DISCONNECT
  // ----------------------------------------------------------
  socket.on("disconnect", () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    if (socket.isHost) {
      io.to(room.code).emit("room-closed", { message: "Host đã rời phòng!" });
      rooms.delete(room.code);
      console.log(`[Room ${room.code}] Closed (host left)`);
      broadcastRoomList();
    } else {
      room.players.delete(socket.id);
      io.to(room.code).emit("player-list-updated", {
        players: getPlayerList(room),
      });
      io.to(room.code).emit("player-left", { playerName: socket.playerName });
      broadcastRoomList();
    }
  });
});

// ============================================================
// HELPERS
// ============================================================
function getPlayerList(room) {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost || false,
  }));
}

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  let localIP = "localhost";
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  console.log(`\n🎯 Lô Tô Server đang chạy!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Mobile:  http://${localIP}:${PORT}\n`);
});
