const express = require("express");
const app = express()
const port = 8000;
const path = require("path");
const cors = require("cors");
app.use(cors());

const http = require("http");

// Server Initialization
const socketio = require("socket.io");
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*", // Allow all origins (or specify your client URL)
    methods: ["GET", "POST"]
  }
});

// Establishing Connection
io.on("connection", function (socket) {
  socket.on("send-location", function (data) {
    io.emit("receive-location", { id: socket.id, ...data });
  });
  console.log("New user connected:", socket.id);

  socket.on("user-joined", function (data) {
    io.emit("user-joined", data);
  });

  // socket.on("message", (data) => {
  //   console.log("Message received:", data);
  //   io.emit("message", data); // Broadcast to all clients
  // });

  socket.on("disconnect", () => {
    io.emit("user-disconnected", socket.id);
    console.log("User disconnected:", socket.id);
  });
  
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

server.listen(port,'0.0.0.0', () => {
  console.log(`For LAN: http://0.0.0.0:${8000}`);
});