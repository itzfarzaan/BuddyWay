const express = require("express");
const app = express()
const port = 8002;const path = require("path");
const cors = require("cors");
const fs = require("fs");
app.use(cors());

const http = require("http");

// Server Initialization
const socketio = require("socket.io");
const server = http.createServer(app);
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

// Session management
const sessions = {};
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// Load sessions from file if exists
try {
  if (fs.existsSync(SESSION_FILE)) {
    const sessionsData = fs.readFileSync(SESSION_FILE, 'utf8');
    Object.assign(sessions, JSON.parse(sessionsData));
    console.log(`Loaded ${Object.keys(sessions).length} sessions from file`);
  }
} catch (err) {
  console.error('Error loading sessions from file:', err);
}

// Save sessions to file
function saveSessions() {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions), 'utf8');
    console.log(`Saved ${Object.keys(sessions).length} sessions to file`);
  } catch (err) {
    console.error('Error saving sessions to file:', err);
  }
}

// Function to generate unique session code
function generateSessionCode() {
  return Math.random().toString(36).substr(2, 9);
}

// Establishing Connection
io.on("connection", function (socket) {
  console.log("New user connected:", socket.id);

  // Create a new session
  socket.on("create-session", function (data) {
    const { sessionCode, hostId, userName } = data;
    
    // Create session if it doesn't exist
    if (!sessions[sessionCode]) {
      sessions[sessionCode] = {
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
      
      // Join socket to session room
      socket.join(sessionCode);
      
      console.log(`Session created: ${sessionCode} by ${userName} (${hostId})`);
      
      // Emit session members to all in session
      io.to(sessionCode).emit("session-members", {
        sessionCode,
        members: sessions[sessionCode].members
      });
      
      // Save sessions to file
      saveSessions();
    } else {
      // Session already exists
      
      // Check if session has expired flag but is still in memory
      if (sessions[sessionCode].expiresAt) {
        // Remove expiration - session is being reactivated
        delete sessions[sessionCode].expiresAt;
        console.log(`Session reactivated: ${sessionCode}`);
      }
      
      // Update host info
      sessions[sessionCode].members[hostId] = {
        id: hostId,
        name: userName,
        isHost: true
      };
      
      // If this is a different host, update the host ID
      if (sessions[sessionCode].hostId !== hostId) {
        console.log(`New host for session: ${sessionCode} - ${userName} (${hostId})`);
        sessions[sessionCode].hostId = hostId;
      }
      
      // Join socket to session room
      socket.join(sessionCode);
      
      console.log(`Host joined session: ${sessionCode} - ${userName} (${hostId})`);
      
      // Emit session members to all in session
      io.to(sessionCode).emit("session-members", {
        sessionCode,
        members: sessions[sessionCode].members
      });
      
      // Notify others that host joined
      socket.to(sessionCode).emit("user-joined", {
        sessionCode,
        id: hostId,
        name: userName
      });
      
      // If there's a common destination, send it to the new host
      if (sessions[sessionCode].commonDestination) {
        socket.emit("common-destination-update", {
          sessionCode,
          destination: sessions[sessionCode].commonDestination,
          active: sessions[sessionCode].commonDestinationActive
        });
      }
      
      // Save sessions to file
      saveSessions();
    }
  });
  
  // Join an existing session
  socket.on("join-session", function (data) {
    const { sessionCode, userId, userName, isHost } = data;
    
    console.log(`Join session request: ${sessionCode} - ${userName} (${userId})`);
    
    // Check if session exists
    if (sessions[sessionCode]) {
      // Check if session has expired flag but is still in memory
      if (sessions[sessionCode].expiresAt) {
        // Remove expiration - session is being reactivated
        delete sessions[sessionCode].expiresAt;
        console.log(`Session reactivated: ${sessionCode}`);
      }
      
      // Add member to session
      sessions[sessionCode].members[userId] = {
        id: userId,
        name: userName,
        isHost: isHost || false
      };
      
      // Join socket to session room
      socket.join(sessionCode);
      
      console.log(`User joined session: ${sessionCode} - ${userName} (${userId})`);
      
      // Send success response
      socket.emit("session-join-response", {
        success: true,
        sessionCode
      });
      
      // Emit session members to all in session
      io.to(sessionCode).emit("session-members", {
        sessionCode,
        members: sessions[sessionCode].members
      });
      
      // Notify others that user joined
      socket.to(sessionCode).emit("user-joined", {
        sessionCode,
        id: userId,
        name: userName
      });
      
      // If there's a common destination, send it to the new member
      if (sessions[sessionCode].commonDestination) {
        console.log(`Sending common destination to new member ${userName} (${userId}):`, 
          sessions[sessionCode].commonDestination, 
          "Active:", sessions[sessionCode].commonDestinationActive);
          
        socket.emit("common-destination-update", {
          sessionCode,
          destination: sessions[sessionCode].commonDestination,
          active: sessions[sessionCode].commonDestinationActive
        });
      }
      
      // Save sessions to file
      saveSessions();
    } else {
      // Session doesn't exist
      console.log(`Session not found: ${sessionCode}`);
      socket.emit("session-join-response", {
        success: false,
        message: "Session not found"
      });
    }
  });
  
  // Leave session
  socket.on("leave-session", function (data) {
    const { sessionCode, userId } = data;
    
    if (sessions[sessionCode] && sessions[sessionCode].members[userId]) {
      // Remove member from session
      delete sessions[sessionCode].members[userId];
      
      // Leave socket room
      socket.leave(sessionCode);
      
      console.log(`User left session: ${sessionCode} - ${userId}`);
      
      // Emit updated members list
      io.to(sessionCode).emit("session-members", {
        sessionCode,
        members: sessions[sessionCode].members
      });
      
      // If no members left, clean up session
      if (Object.keys(sessions[sessionCode].members).length === 0) {
        delete sessions[sessionCode];
        console.log(`Session deleted (empty): ${sessionCode}`);
      }
      
      // Save sessions to file
      saveSessions();
    }
  });
  
  // End session (host only)
  socket.on("end-session", function (data) {
    const { sessionCode, hostId } = data;
    
    if (sessions[sessionCode] && sessions[sessionCode].hostId === hostId) {
      // Notify all members that session ended
      io.to(sessionCode).emit("session-ended");
      
      // Delete session
      delete sessions[sessionCode];
      
      console.log(`Session ended by host: ${sessionCode}`);
      
      // Save sessions to file
      saveSessions();
    }
  });
  
  // Send location to session members only
  socket.on("send-location", function (data) {
    const { sessionCode, latitude, longitude, name } = data;
    
    if (sessions[sessionCode]) {
      // Send location only to session members
      io.to(sessionCode).emit("receive-location", { 
        sessionCode,
        id: socket.id, 
        latitude, 
        longitude, 
        name 
      });
    }
  });
  
  // Handle member route sharing
  socket.on("member-has-route", function (data) {
    const { sessionCode, userId, hasRoute, startPoint, endPoint } = data;
    
    if (!sessions[sessionCode]) return;
    
    // Broadcast route information to all members in the session
    io.to(sessionCode).emit("member-route-update", {
      sessionCode,
      userId,
      hasRoute,
      startPoint,
      endPoint
    });
  });

  // Set common destination for all members in a session
  socket.on("set-common-destination", function (data) {
    const { sessionCode, hostId, destination, active } = data;
    
    console.log("Setting common destination:", data);
    
    if (!sessionCode || !hostId || !destination) {
      console.log("Missing required data for set-common-destination");
      return;
    }
    
    if (!sessions[sessionCode]) {
      console.log("Session not found:", sessionCode);
      return;
    }
    
    // Only allow host to set common destination
    if (sessions[sessionCode].hostId !== hostId) {
      console.log("User is not host. Session hostId:", sessions[sessionCode].hostId, "User hostId:", hostId);
      return;
    }
    
    // Update session with common destination
    sessions[sessionCode].commonDestination = destination;
    sessions[sessionCode].commonDestinationActive = active || false;
    
    console.log("Updated session with common destination:", 
      sessions[sessionCode].commonDestination, 
      "Active:", sessions[sessionCode].commonDestinationActive);
    
    // Broadcast to all members in session
    io.to(sessionCode).emit("common-destination-update", {
      sessionCode,
      destination,
      active: sessions[sessionCode].commonDestinationActive
    });
    
    // Save sessions to file
    saveSessions();
  });
  
  // Clear common destination for all members in a session
  socket.on("clear-common-destination", function (data) {
    const { sessionCode, hostId } = data;
    
    if (!sessionCode || !hostId) return;
    
    if (!sessions[sessionCode]) return;
    
    // Only allow host to clear common destination
    if (sessions[sessionCode].hostId !== hostId) return;
    
    // Clear common destination
    sessions[sessionCode].commonDestination = null;
    sessions[sessionCode].commonDestinationActive = false;
    
    // Broadcast to all members in session
    io.to(sessionCode).emit("common-destination-update", {
      sessionCode,
      destination: null
    });
    
    // Save sessions to file
    saveSessions();
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    // Find and leave all sessions user was in
    for (const sessionCode in sessions) {
      if (sessions[sessionCode].members[socket.id]) {
        const userName = sessions[sessionCode].members[socket.id].name;
        const isHost = sessions[sessionCode].hostId === socket.id;
        
        // Remove from session
        delete sessions[sessionCode].members[socket.id];
        
        // Notify others
        io.to(sessionCode).emit("user-disconnected", socket.id);
        
        // Update members list
        io.to(sessionCode).emit("session-members", {
          sessionCode,
          members: sessions[sessionCode].members
        });
        
        console.log(`User disconnected from session: ${sessionCode} - ${userName} (${socket.id})`);
        
        // If user was host, don't end session immediately
        // This allows the host to reconnect and preserves the session
        if (isHost) {
          console.log(`Host disconnected from session: ${sessionCode} - session will be preserved`);
          
          // Keep session alive for at least 30 minutes
          // Don't delete it even if empty
          sessions[sessionCode].expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes
        }
        // If no members left, don't delete immediately
        // Give time for page navigation and reconnection
        else if (Object.keys(sessions[sessionCode].members).length === 0) {
          console.log(`Session empty: ${sessionCode} - will be preserved for reconnection`);
          
          // Keep session alive for 5 minutes if empty
          sessions[sessionCode].expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
        }
        
        // Save sessions to file
        saveSessions();
      }
    }
    
    console.log("User disconnected:", socket.id);
  });
});

// Clean up expired sessions every minute
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const sessionCode in sessions) {
    if (sessions[sessionCode].expiresAt && sessions[sessionCode].expiresAt < now) {
      delete sessions[sessionCode];
      cleanedCount++;
      console.log(`Session expired and removed: ${sessionCode}`);
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired sessions`);
    saveSessions();
  }
}, 60000); // Check every minute

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Home page (landing page)
app.get("/", (req, res) => {
  res.render("home");
});

// Map page (requires session)
app.get("/map", (req, res) => {
  res.render("index");
});

const PORT = process.env.PORT || 8002;
server.listen(PORT, () => {
  console.log(`BuddyWay server started on port ${PORT}`);
});