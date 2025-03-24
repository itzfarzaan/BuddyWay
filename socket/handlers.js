const sessionManager = require('../models/sessionManager');

/**
 * Socket event handlers for BuddyWay
 * @param {Object} io - Socket.IO instance
 * @returns {Object} Socket event handlers
 */
function createSocketHandlers(io) {
  return {
    /**
     * Handle create session event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Session data
     */
    createSession(socket, data) {
      const { sessionCode, hostId, userName } = data;
      
      const result = sessionManager.createOrUpdateSession(sessionCode, hostId, userName);
      
      // Join socket to session room
      socket.join(sessionCode);
      
      // Emit session members to all in session
      io.to(sessionCode).emit("session-members", {
        sessionCode,
        members: result.session.members
      });
      
      // If not a new session, notify others that host joined
      if (!result.isNew) {
        socket.to(sessionCode).emit("user-joined", {
          sessionCode,
          id: hostId,
          name: userName
        });
        
        // If there's a common destination, send it to the new host
        if (result.session.commonDestination) {
          socket.emit("common-destination-update", {
            sessionCode,
            destination: result.session.commonDestination,
            active: result.session.commonDestinationActive
          });
        }
      }
    },
    
    /**
     * Handle join session event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Session data
     */
    joinSession(socket, data) {
      const { sessionCode, userId, userName, isHost } = data;
      
      const result = sessionManager.joinSession(sessionCode, userId, userName, isHost);
      
      if (result.success) {
        // Join socket to session room
        socket.join(sessionCode);
        
        // Send success response
        socket.emit("session-join-response", {
          success: true,
          sessionCode
        });
        
        // Emit session members to all in session
        io.to(sessionCode).emit("session-members", {
          sessionCode,
          members: result.session.members
        });
        
        // Notify others that user joined
        socket.to(sessionCode).emit("user-joined", {
          sessionCode,
          id: userId,
          name: userName
        });
        
        // Send all existing member locations to the new user
        const sessionLocations = sessionManager.getSessionLocations(sessionCode);
        if (sessionLocations) {
          // Send each stored location to the new user
          Object.values(sessionLocations).forEach(location => {
            // Don't send the user's own location back to them
            if (location.id !== userId) {
              socket.emit("receive-location", {
                sessionCode,
                id: location.id,
                latitude: location.latitude,
                longitude: location.longitude,
                name: location.name
              });
            }
          });
        }
        
        // Send all existing routes to the new user
        const sessionRoutes = sessionManager.getSessionRoutes(sessionCode);
        if (sessionRoutes) {
          // Send each stored route to the new user
          Object.values(sessionRoutes).forEach(route => {
            // Don't send the user's own routes back to them
            if (route.userId !== userId) {
              socket.emit("member-route-update", {
                sessionCode,
                userId: route.userId,
                hasRoute: route.hasRoute,
                startPoint: route.startPoint,
                endPoint: route.endPoint,
                usingLiveLocation: route.usingLiveLocation,
                targetUserId: route.targetUserId
              });
            }
          });
        }
        
        // If there's a common destination, send it to the new member
        if (result.session.commonDestination) {
          console.log(`Sending common destination to new member ${userName} (${userId}):`, 
            result.session.commonDestination, 
            "Active:", result.session.commonDestinationActive);
            
          socket.emit("common-destination-update", {
            sessionCode,
            destination: result.session.commonDestination,
            active: result.session.commonDestinationActive
          });
        }
      } else {
        // Session doesn't exist
        socket.emit("session-join-response", {
          success: false,
          message: result.message
        });
      }
    },
    
    /**
     * Handle leave session event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Session data
     */
    leaveSession(socket, data) {
      const { sessionCode, userId } = data;
      
      const success = sessionManager.leaveSession(sessionCode, userId);
      
      if (success) {
        // Leave socket room
        socket.leave(sessionCode);
        
        // Emit updated members list
        const session = sessionManager.sessions[sessionCode];
        if (session) {
          io.to(sessionCode).emit("session-members", {
            sessionCode,
            members: session.members
          });
        }
      }
    },
    
    /**
     * Handle end session event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Session data
     */
    endSession(socket, data) {
      const { sessionCode, hostId } = data;
      
      const success = sessionManager.endSession(sessionCode, hostId);
      
      if (success) {
        // Notify all members that session ended
        io.to(sessionCode).emit("session-ended");
      }
    },
    
    /**
     * Handle send location event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Location data
     */
    sendLocation(socket, data) {
      const { sessionCode, latitude, longitude, name } = data;
      
      const location = sessionManager.updateLocation(sessionCode, socket.id, latitude, longitude, name);
      
      if (location) {
        // Send location only to session members
        io.to(sessionCode).emit("receive-location", { 
          sessionCode,
          id: socket.id, 
          latitude, 
          longitude, 
          name 
        });
      }
    },
    
    /**
     * Handle member route sharing event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Route data
     */
    memberHasRoute(socket, data) {
      const { sessionCode, userId, hasRoute, startPoint, endPoint, usingLiveLocation, targetUserId } = data;
      
      const route = sessionManager.updateRoute(
        sessionCode, 
        userId, 
        hasRoute, 
        startPoint, 
        endPoint, 
        usingLiveLocation, 
        targetUserId
      );
      
      if (route) {
        // Broadcast route information to all members in the session
        io.to(sessionCode).emit("member-route-update", {
          sessionCode,
          userId,
          hasRoute,
          startPoint,
          endPoint,
          usingLiveLocation,
          targetUserId
        });
      }
    },
    
    /**
     * Handle set common destination event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Destination data
     */
    setCommonDestination(socket, data) {
      const { sessionCode, hostId, destination, active } = data;
      
      console.log("Setting common destination:", data);
      
      const result = sessionManager.setCommonDestination(sessionCode, hostId, destination, active);
      
      if (result) {
        // Broadcast to all members in session
        io.to(sessionCode).emit("common-destination-update", result);
      }
    },
    
    /**
     * Handle clear common destination event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Session data
     */
    clearCommonDestination(socket, data) {
      const { sessionCode, hostId } = data;
      
      const success = sessionManager.clearCommonDestination(sessionCode, hostId);
      
      if (success) {
        // Broadcast to all members in session
        io.to(sessionCode).emit("common-destination-update", {
          sessionCode,
          destination: null,
          active: false
        });
      }
    },
    
    /**
     * Handle common destination deactivation event
     * @param {Object} socket - Socket instance
     * @param {Object} data - Session data
     */
    commonDestinationDeactivated(socket, data) {
      const { sessionCode } = data;
      
      sessionManager.deactivateCommonDestination(sessionCode);
    },
    
    /**
     * Handle disconnect event
     * @param {Object} socket - Socket instance
     */
    disconnect(socket) {
      const affectedSessions = sessionManager.handleDisconnection(socket.id);
      
      // Notify others in each affected session
      affectedSessions.forEach(session => {
        io.to(session.sessionCode).emit("user-disconnected", socket.id);
        
        // Update members list
        const currentSession = sessionManager.sessions[session.sessionCode];
        if (currentSession) {
          io.to(session.sessionCode).emit("session-members", {
            sessionCode: session.sessionCode,
            members: currentSession.members
          });
        }
      });
      
      console.log("User disconnected:", socket.id);
    }
  };
}

module.exports = createSocketHandlers;
