const fs = require("fs");
const path = require("path");

class SessionManager {
  constructor() {
    this.sessions = {};
    this.sessionLocations = {};
    this.sessionRoutes = {};
    this.SESSION_FILE = path.join(process.cwd(), 'sessions.json');
    
    // Load sessions from file if exists
    this.loadSessions();
  }

  /**
   * Load sessions from file
   */
  loadSessions() {
    try {
      if (fs.existsSync(this.SESSION_FILE)) {
        const sessionsData = fs.readFileSync(this.SESSION_FILE, 'utf8');
        Object.assign(this.sessions, JSON.parse(sessionsData));
        console.log(`Loaded ${Object.keys(this.sessions).length} sessions from file`);
      }
    } catch (err) {
      console.error('Error loading sessions from file:', err);
    }
  }

  /**
   * Save sessions to file
   */
  saveSessions() {
    try {
      fs.writeFileSync(this.SESSION_FILE, JSON.stringify(this.sessions), 'utf8');
      console.log(`Saved ${Object.keys(this.sessions).length} sessions to file`);
    } catch (err) {
      console.error('Error saving sessions to file:', err);
    }
  }

  /**
   * Generate a unique session code
   * @returns {string} Session code
   */
  generateSessionCode() {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Create a new session or update existing one
   * @param {string} sessionCode - Session code
   * @param {string} hostId - Host ID
   * @param {string} userName - Host name
   * @returns {Object} Session data
   */
  createOrUpdateSession(sessionCode, hostId, userName) {
    // Create session if it doesn't exist
    if (!this.sessions[sessionCode]) {
      this.sessions[sessionCode] = {
        hostId: hostId,
        createdAt: Date.now(),
        members: {
          [hostId]: {
            id: hostId,
            name: userName,
            isHost: true
          }
        },
        commonDestination: null,
        commonDestinationActive: false
      };
      
      console.log(`Session created: ${sessionCode} by ${userName} (${hostId})`);
      
      // Save sessions to file
      this.saveSessions();
      return { isNew: true, session: this.sessions[sessionCode] };
    } else {
      // Session already exists
      
      // Check if session has expired flag but is still in memory
      if (this.sessions[sessionCode].expiresAt) {
        // Remove expiration - session is being reactivated
        delete this.sessions[sessionCode].expiresAt;
        console.log(`Session reactivated: ${sessionCode}`);
      }
      
      // Update host info
      this.sessions[sessionCode].members[hostId] = {
        id: hostId,
        name: userName,
        isHost: true
      };
      
      // If this is a different host, update the host ID
      if (this.sessions[sessionCode].hostId !== hostId) {
        console.log(`New host for session: ${sessionCode} - ${userName} (${hostId})`);
        this.sessions[sessionCode].hostId = hostId;
      }
      
      console.log(`Host joined session: ${sessionCode} - ${userName} (${hostId})`);
      
      // Save sessions to file
      this.saveSessions();
      return { isNew: false, session: this.sessions[sessionCode] };
    }
  }

  /**
   * Add a user to an existing session
   * @param {string} sessionCode - Session code
   * @param {string} userId - User ID
   * @param {string} userName - User name
   * @param {boolean} isHost - Whether user is host
   * @returns {Object} Result with success status and session data
   */
  joinSession(sessionCode, userId, userName, isHost = false) {
    console.log(`Join session request: ${sessionCode} - ${userName} (${userId})`);
    
    // Check if session exists
    if (this.sessions[sessionCode]) {
      // Check if session has expired flag but is still in memory
      if (this.sessions[sessionCode].expiresAt) {
        // Remove expiration - session is being reactivated
        delete this.sessions[sessionCode].expiresAt;
        console.log(`Session reactivated: ${sessionCode}`);
      }
      
      // Add member to session
      this.sessions[sessionCode].members[userId] = {
        id: userId,
        name: userName,
        isHost: isHost || false
      };
      
      console.log(`User joined session: ${sessionCode} - ${userName} (${userId})`);
      
      // Save sessions to file
      this.saveSessions();
      
      return { 
        success: true, 
        sessionCode, 
        session: this.sessions[sessionCode]
      };
    } else {
      // Session doesn't exist
      console.log(`Session not found: ${sessionCode}`);
      return {
        success: false,
        message: "Session not found"
      };
    }
  }

  /**
   * Remove a user from a session
   * @param {string} sessionCode - Session code
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  leaveSession(sessionCode, userId) {
    if (this.sessions[sessionCode] && this.sessions[sessionCode].members[userId]) {
      // Remove member from session
      delete this.sessions[sessionCode].members[userId];
      
      // Remove stored location for this user
      if (this.sessionLocations[sessionCode] && this.sessionLocations[sessionCode][userId]) {
        delete this.sessionLocations[sessionCode][userId];
      }
      
      // Remove stored routes for this user
      if (this.sessionRoutes[sessionCode] && this.sessionRoutes[sessionCode][userId]) {
        delete this.sessionRoutes[sessionCode][userId];
      }
      
      console.log(`User left session: ${sessionCode} - ${userId}`);
      
      // If no members left, clean up session
      if (Object.keys(this.sessions[sessionCode].members).length === 0) {
        delete this.sessions[sessionCode];
        delete this.sessionLocations[sessionCode];
        delete this.sessionRoutes[sessionCode];
        console.log(`Session deleted (empty): ${sessionCode}`);
      }
      
      // Save sessions to file
      this.saveSessions();
      return true;
    }
    return false;
  }

  /**
   * End a session (host only)
   * @param {string} sessionCode - Session code
   * @param {string} hostId - Host ID
   * @returns {boolean} Success status
   */
  endSession(sessionCode, hostId) {
    if (this.sessions[sessionCode] && this.sessions[sessionCode].hostId === hostId) {
      // Delete session
      delete this.sessions[sessionCode];
      
      console.log(`Session ended by host: ${sessionCode}`);
      
      // Save sessions to file
      this.saveSessions();
      return true;
    }
    return false;
  }

  /**
   * Update location for a user in a session
   * @param {string} sessionCode - Session code
   * @param {string} userId - User ID
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {string} name - User name
   * @returns {Object|null} Location data or null if session not found
   */
  updateLocation(sessionCode, userId, latitude, longitude, name) {
    if (this.sessions[sessionCode]) {
      // Store the location in sessionLocations
      if (!this.sessionLocations[sessionCode]) {
        this.sessionLocations[sessionCode] = {};
      }
      
      // Save this user's location
      this.sessionLocations[sessionCode][userId] = {
        id: userId,
        latitude,
        longitude,
        name
      };
      
      return this.sessionLocations[sessionCode][userId];
    }
    return null;
  }

  /**
   * Get all locations for a session
   * @param {string} sessionCode - Session code
   * @returns {Object|null} All locations for the session or null if not found
   */
  getSessionLocations(sessionCode) {
    return this.sessionLocations[sessionCode] || null;
  }

  /**
   * Update or remove route for a user
   * @param {string} sessionCode - Session code
   * @param {string} userId - User ID
   * @param {boolean} hasRoute - Whether user has a route
   * @param {Object} startPoint - Start point
   * @param {Object} endPoint - End point
   * @param {boolean} usingLiveLocation - Whether using live location
   * @param {string} targetUserId - Target user ID if following another user
   * @returns {Object|null} Route data or null if session not found
   */
  updateRoute(sessionCode, userId, hasRoute, startPoint, endPoint, usingLiveLocation, targetUserId) {
    if (!this.sessions[sessionCode]) return null;
    
    // Store or update route information
    if (!this.sessionRoutes[sessionCode]) {
      this.sessionRoutes[sessionCode] = {};
    }
    
    if (hasRoute) {
      // Store the route
      this.sessionRoutes[sessionCode][userId] = {
        userId,
        hasRoute,
        startPoint,
        endPoint,
        usingLiveLocation,
        targetUserId
      };
      
      return this.sessionRoutes[sessionCode][userId];
    } else {
      // Remove the route if hasRoute is false
      if (this.sessionRoutes[sessionCode][userId]) {
        delete this.sessionRoutes[sessionCode][userId];
      }
      return { userId, hasRoute: false };
    }
  }

  /**
   * Get all routes for a session
   * @param {string} sessionCode - Session code
   * @returns {Object|null} All routes for the session or null if not found
   */
  getSessionRoutes(sessionCode) {
    return this.sessionRoutes[sessionCode] || null;
  }

  /**
   * Set common destination for a session
   * @param {string} sessionCode - Session code
   * @param {string} hostId - Host ID
   * @param {Object} destination - Destination data
   * @param {boolean} active - Whether destination is active
   * @returns {Object|null} Updated session or null if not found/not authorized
   */
  setCommonDestination(sessionCode, hostId, destination, active) {
    if (!sessionCode || !hostId || !destination) {
      console.log("Missing required data for set-common-destination");
      return null;
    }
    
    if (!this.sessions[sessionCode]) {
      console.log("Session not found:", sessionCode);
      return null;
    }
    
    // Only allow host to set common destination
    if (this.sessions[sessionCode].hostId !== hostId) {
      console.log("User is not host. Session hostId:", this.sessions[sessionCode].hostId, "User hostId:", hostId);
      return null;
    }
    
    // Update session with common destination
    this.sessions[sessionCode].commonDestination = destination;
    this.sessions[sessionCode].commonDestinationActive = active || false;
    
    console.log("Updated session with common destination:", 
      this.sessions[sessionCode].commonDestination, 
      "Active:", this.sessions[sessionCode].commonDestinationActive);
    
    // Save sessions to file
    this.saveSessions();
    
    return {
      sessionCode,
      destination,
      active: this.sessions[sessionCode].commonDestinationActive
    };
  }

  /**
   * Clear common destination for a session
   * @param {string} sessionCode - Session code
   * @param {string} hostId - Host ID
   * @returns {boolean} Success status
   */
  clearCommonDestination(sessionCode, hostId) {
    if (!sessionCode || !hostId) return false;
    
    if (!this.sessions[sessionCode]) return false;
    
    // Only allow host to clear common destination
    if (this.sessions[sessionCode].hostId !== hostId) return false;
    
    // Clear common destination
    this.sessions[sessionCode].commonDestination = null;
    this.sessions[sessionCode].commonDestinationActive = false;
    
    // Save sessions to file
    this.saveSessions();
    
    return true;
  }

  /**
   * Deactivate common destination for a session
   * @param {string} sessionCode - Session code
   * @returns {boolean} Success status
   */
  deactivateCommonDestination(sessionCode) {
    if (!sessionCode || !this.sessions[sessionCode]) return false;
    
    // Update session state
    this.sessions[sessionCode].commonDestinationActive = false;
    
    // Save sessions to file
    this.saveSessions();
    
    return true;
  }

  /**
   * Handle user disconnection
   * @param {string} userId - User ID
   * @returns {Array} List of affected sessions
   */
  handleDisconnection(userId) {
    const affectedSessions = [];
    
    for (const sessionCode in this.sessions) {
      if (this.sessions[sessionCode].members[userId]) {
        const userName = this.sessions[sessionCode].members[userId].name;
        const isHost = this.sessions[sessionCode].hostId === userId;
        
        // Remove from session
        delete this.sessions[sessionCode].members[userId];
        
        // Remove stored location for this user
        if (this.sessionLocations[sessionCode] && this.sessionLocations[sessionCode][userId]) {
          delete this.sessionLocations[sessionCode][userId];
        }
        
        // Remove stored routes for this user
        if (this.sessionRoutes[sessionCode] && this.sessionRoutes[sessionCode][userId]) {
          delete this.sessionRoutes[sessionCode][userId];
        }
        
        console.log(`User ${userName} (${userId}) disconnected from session ${sessionCode}`);
        
        // If user was host, don't end session immediately
        // This allows the host to reconnect and preserves the session
        if (isHost) {
          console.log(`Host disconnected from session: ${sessionCode} - session will be preserved`);
          
          // Keep session alive for at least 30 minutes
          // Don't delete it even if empty
          this.sessions[sessionCode].expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes
        }
        // If no members left, don't delete immediately
        // Give time for page navigation and reconnection
        else if (Object.keys(this.sessions[sessionCode].members).length === 0) {
          console.log(`Session empty: ${sessionCode} - will be preserved for reconnection`);
          
          // Keep session alive for 5 minutes if empty
          this.sessions[sessionCode].expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
          
          // Also mark location and route data for cleanup, but don't delete immediately
          // to allow for reconnections
          if (this.sessionLocations[sessionCode]) {
            this.sessionLocations[sessionCode].expiresAt = this.sessions[sessionCode].expiresAt;
          }
          if (this.sessionRoutes[sessionCode]) {
            this.sessionRoutes[sessionCode].expiresAt = this.sessions[sessionCode].expiresAt;
          }
        }
        
        affectedSessions.push({
          sessionCode,
          userName,
          isHost
        });
      }
    }
    
    // Save sessions to file if any changes were made
    if (affectedSessions.length > 0) {
      this.saveSessions();
    }
    
    return affectedSessions;
  }

  /**
   * Clean up expired sessions
   * @returns {number} Number of cleaned sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const sessionCode in this.sessions) {
      if (this.sessions[sessionCode].expiresAt && this.sessions[sessionCode].expiresAt < now) {
        delete this.sessions[sessionCode];
        cleanedCount++;
        console.log(`Session expired and removed: ${sessionCode}`);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
      this.saveSessions();
    }
    
    return cleanedCount;
  }
}

module.exports = new SessionManager();
