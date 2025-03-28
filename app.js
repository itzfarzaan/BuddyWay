const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const http = require("http");

// Import modules
const configureSocketIO = require('./config/socketConfig');
const setupSocketEvents = require('./socket/events');
const setupRoutes = require('./routes');

// Middleware
app.use(cors());

// Server Initialization
const server = http.createServer(app);
const io = configureSocketIO(server);

// Setup socket events
const { cleanupInterval } = setupSocketEvents(io);

// View engine setup
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Setup routes
setupRoutes(app);

// Start server
const PORT = process.env.PORT || 8002;
server.listen(PORT, () => {
  console.log(`BuddyWay server started on port ${PORT}`);
});
