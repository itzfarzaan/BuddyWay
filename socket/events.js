const createSocketHandlers = require('./handlers');
const sessionManager = require('../models/sessionManager');

/**
 * Set up Socket.IO event listeners
 * @param {Object} io - Socket.IO instance
 */
function setupSocketEvents(io) {
  const handlers = createSocketHandlers(io);

  // Set up interval to clean up expired sessions
  const cleanupInterval = setInterval(() => {
    sessionManager.cleanupExpiredSessions();
  }, 60000); // Check every minute

  // Handle connection event
  io.on("connection", function (socket) {
    console.log("New user connected:", socket.id);

    // Create a new session
    socket.on("create-session", (data) => handlers.createSession(socket, data));
    
    // Join an existing session
    socket.on("join-session", (data) => handlers.joinSession(socket, data));
    
    // Leave session
    socket.on("leave-session", (data) => handlers.leaveSession(socket, data));
    
    // End session (host only)
    socket.on("end-session", (data) => handlers.endSession(socket, data));
    
    // Send location to session members only
    socket.on("send-location", (data) => handlers.sendLocation(socket, data));
    
    // Handle member route sharing
    socket.on("member-has-route", (data) => handlers.memberHasRoute(socket, data));
    
    // Set common destination for all members in a session
    socket.on("set-common-destination", (data) => handlers.setCommonDestination(socket, data));
    
    // Clear common destination for all members in a session
    socket.on("clear-common-destination", (data) => handlers.clearCommonDestination(socket, data));
    
    // Handle common destination deactivation
    socket.on("common-destination-deactivated", (data) => handlers.commonDestinationDeactivated(socket, data));

    // Handle disconnection
    socket.on("disconnect", () => handlers.disconnect(socket));
  });

  return { io, cleanupInterval };
}

module.exports = setupSocketEvents;
