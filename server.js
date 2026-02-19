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

  // Create ONE shared shuffled pool per column for all tickets
  const colPools = colRanges.map(([min, max]) => {
    const nums = [];
    for (let i = min; i <= max; i++) nums.push(i);
    return shuffle(nums);
  });

  const tickets = [];
  for (let t = 0; t < count; t++) {
    const grid = Array.from({ length: 3 }, () => Array(9).fill(0));

    for (let row = 0; row < 3; row++) {
      const cols = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8])
        .slice(0, 5)
        .sort((a, b) => a - b);
      for (const col of cols) {
        if (colPools[col].length > 0) {
          grid[row][col] = colPools[col].pop();
        }
      }
    }

    // Sort within each column
    for (let col = 0; col < 9; col++) {
      const colVals = [];
      for (let row = 0; row < 3; row++) {
        if (grid[row][col] !== 0) colVals.push(grid[row][col]);
      }
      colVals.sort((a, b) => a - b);
      let idx = 0;
      for (let row = 0; row < 3; row++) {
        if (grid[row][col] !== 0) {
          grid[row][col] = colVals[idx++];
        }
      }
    }

    tickets.push(grid);
  }

  return tickets;
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

    // Check if drawn number matches any declared near-loto number
    let nearLotoMatch = null;
    for (const [pid, info] of room.nearLotoPlayers) {
      if (info.missingNumbers.includes(drawn)) {
        nearLotoMatch = { playerName: info.playerName, number: drawn };
        // Remove this player from near-loto since their number was drawn
        room.nearLotoPlayers.delete(pid);
        break;
      }
    }

    io.to(room.code).emit("number-drawn", {
      number: drawn,
      drawnNumbers: room.drawnNumbers,
      remaining: available.length - 1,
      spinDuration: room.spinDuration,
      nearLotoMatch, // null or { playerName, number }
    });
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

    io.to(room.code).emit("loto-claimed", {
      playerName: player.name,
      ticketIndex,
    });
  });

  // ----------------------------------------------------------
  // RESET GAME
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

    io.to(room.code).emit("game-reset");
    console.log(`[Room ${room.code}] Game reset!`);
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
