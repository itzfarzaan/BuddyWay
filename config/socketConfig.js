const socketio = require("socket.io");

/**
 * Configure and initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Configured Socket.IO instance
 */
function configureSocketIO(server) {
  const io = socketio(server, {
    cors: {
      origin: "*", // Allow all origins
      methods: ["GET", "POST"],
      credentials: true
    },
    // Improve connection reliability
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    cookie: false
  });

  return io;
}

module.exports = configureSocketIO;
