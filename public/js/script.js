// Initialize socket connection
let userId = socket.id;
let userLat = 0;
let userLng = 0;
let firstUpdate = true;
const markers = {};
const userNames = {};
let myName = "";
let routingControl = null;
let isPickingLocation = false;
let activeInput = null;
let startMarker = null;
let endMarker = null;

// Add connection debugging
socket.on('connect', () => {
  console.log('Map page: Socket connected with ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Map page: Socket connection error:', error);
});

// Session variables
let currentSession = null;
let isHost = false;
let sessionMembers = {};

// Get session info from URL and localStorage
function getSessionInfo() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionCode = urlParams.get('session');
  
  // If no session in URL, redirect to home
  if (!sessionCode) {
    window.location.href = '/';
    return;
  }
  
  // Get saved session data
  const savedSession = localStorage.getItem('buddyway_session');
  if (savedSession) {
    const sessionData = JSON.parse(savedSession);
    
    // Verify session code matches
    if (sessionData.sessionCode !== sessionCode) {
      // Session mismatch, clear and redirect
      localStorage.removeItem('buddyway_session');
      window.location.href = '/';
      return;
    }
    
    // Set session variables
    currentSession = sessionCode;
    myName = sessionData.userName;
    isHost = sessionData.isHost;
    
    // Update UI
    document.getElementById('sessionCodeDisplay').textContent = currentSession;
    if (isHost) {
      document.body.classList.add('is-host');
    }
    
    return true;
  } else {
    // No saved session, redirect to home
    window.location.href = '/';
    return false;
  }
}

// Initialize map
const map = L.map("map").setView([0, 0], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "BuddyWay"
}).addTo(map);

// Get location and send to server
function setupLocationTracking() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((position) => {
      userLat = position.coords.latitude;
      userLng = position.coords.longitude;

      if (firstUpdate) {
        map.setView([userLat, userLng], 16);
        firstUpdate = false;
        
        // Set initial start location
        document.getElementById('startLocation').value = 'My Location';
        if (startMarker) {
          startMarker.setLatLng([userLat, userLng]);
        } else {
          startMarker = L.marker([userLat, userLng], {
            draggable: true
          }).addTo(map);
          
          startMarker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            document.getElementById('startLocation').value = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
            updateRoute();
          });
        }
      }

      // Only send location if in a session
      if (currentSession) {
        socket.emit("send-location", { 
          sessionCode: currentSession,
          latitude: userLat, 
          longitude: userLng, 
          name: myName 
        });
      }
    }, console.error, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });
  }
}

// Show toast notification
function showToast(message, duration = 3000) {
  // Create toast if it doesn't exist
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  // Set message and show
  toast.textContent = message;
  toast.classList.add('show');
  
  // Hide after duration
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Update members list
function updateMembersList() {
  const membersList = document.getElementById('membersList');
  membersList.innerHTML = '';
  
  Object.keys(sessionMembers).forEach(memberId => {
    const member = sessionMembers[memberId];
    const li = document.createElement('li');
    
    // Create member icon (first letter of name)
    const icon = document.createElement('div');
    icon.className = 'member-icon';
    icon.textContent = member.name.charAt(0).toUpperCase();
    
    // Create member name
    const name = document.createElement('div');
    name.className = 'member-name';
    name.textContent = member.name;
    
    // Add badges if host or self
    if (member.isHost) {
      const hostBadge = document.createElement('span');
      hostBadge.className = 'host-badge';
      hostBadge.textContent = 'Host';
      name.appendChild(hostBadge);
    }
    
    if (memberId === userId) {
      const selfBadge = document.createElement('span');
      selfBadge.className = 'self-badge';
      selfBadge.textContent = 'You';
      name.appendChild(selfBadge);
    }
    
    li.appendChild(icon);
    li.appendChild(name);
    membersList.appendChild(li);
  });
}

// Handle connection
socket.on("connect", () => {
  userId = socket.id;
  
  // Check if we have session info
  if (getSessionInfo()) {
    // Join session
    socket.emit("join-session", {
      sessionCode: currentSession,
      userId: socket.id,
      userName: myName,
      isHost: isHost
    });
    
    // Setup location tracking
    setupLocationTracking();
  }
});

// Handle session members update
socket.on("session-members", (data) => {
  if (data.sessionCode === currentSession) {
    sessionMembers = data.members;
    updateMembersList();
  }
});

// Handle location updates from other users
socket.on("receive-location", (data) => {
  // Only process updates for current session
  if (data.sessionCode !== currentSession) return;
  
  const { id, latitude, longitude, name } = data;
  if (name) userNames[id] = name;
  const displayName = userNames[id] || "Unknown";

  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
    markers[id].getPopup().setContent(`User: ${displayName}`);
  } else {
    markers[id] = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(`User: ${displayName}`)
      .openPopup();
  }
});

// Handle user joined
socket.on("user-joined", (data) => {
  // Only process updates for current session
  if (data.sessionCode !== currentSession) return;
  
  const { id, name } = data;
  userNames[id] = name;
  
  if (markers[id]) {
    markers[id].getPopup().setContent(`User: ${name}`);
  }
  
  showToast(`${name} joined the session`);
});

// Handle disconnection
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
    
    if (userNames[id]) {
      showToast(`${userNames[id]} left the session`);
      delete userNames[id];
    }
  }
});

// Handle session ended
socket.on("session-ended", () => {
  showToast("The session has ended", 5000);
  
  // Clear session data
  localStorage.removeItem('buddyway_session');
  
  // Redirect to home after delay
  setTimeout(() => {
    window.location.href = '/';
  }, 3000);
});

// Copy session code to clipboard
document.getElementById('copySessionCode').addEventListener('click', () => {
  navigator.clipboard.writeText(currentSession)
    .then(() => {
      showToast('Session code copied to clipboard');
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
    });
});

// Leave session
document.getElementById('leaveSession').addEventListener('click', () => {
  if (confirm('Are you sure you want to leave this session?')) {
    socket.emit('leave-session', {
      sessionCode: currentSession,
      userId: userId
    });
    
    // Clear session data
    localStorage.removeItem('buddyway_session');
    
    // Redirect to home
    window.location.href = '/';
  }
});

// End session (host only)
document.getElementById('endSession').addEventListener('click', () => {
  if (isHost && confirm('Are you sure you want to end this session for everyone?')) {
    socket.emit('end-session', {
      sessionCode: currentSession,
      hostId: userId
    });
    
    // Clear session data
    localStorage.removeItem('buddyway_session');
    
    // Redirect to home
    window.location.href = '/';
  }
});

// Navigation functionality
function updateRoute() {
  const start = startMarker ? startMarker.getLatLng() : null;
  const end = endMarker ? endMarker.getLatLng() : null;

  if (start && end) {
    if (routingControl) {
      map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
      waypoints: [
        L.latLng(start.lat, start.lng),
        L.latLng(end.lat, end.lng)
      ],
      routeWhileDragging: true,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      lineOptions: {
        styles: [{ color: '#4285f4', weight: 6, opacity: 0.8 }]
      },
      show: false
    }).addTo(map);
  }
}

// Location picker functionality
function setupLocationPicker(inputId, markerId) {
  const button = document.getElementById(inputId);
  const input = button.previousElementSibling;

  button.addEventListener('click', () => {
    isPickingLocation = true;
    activeInput = input;
    map.once('click', (e) => {
      const { lat, lng } = e.latlng;
      input.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      if (markerId === 'start') {
        if (startMarker) {
          startMarker.setLatLng([lat, lng]);
        } else {
          startMarker = L.marker([lat, lng], {
            draggable: true
          }).addTo(map);
          
          startMarker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            input.value = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
            updateRoute();
          });
        }
      } else {
        if (endMarker) {
          endMarker.setLatLng([lat, lng]);
        } else {
          endMarker = L.marker([lat, lng], {
            draggable: true
          }).addTo(map);
          
          endMarker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            input.value = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
            updateRoute();
          });
        }
      }
      
      isPickingLocation = false;
      activeInput = null;
      updateRoute();
    });
  });
}

// Set up location pickers
setupLocationPicker('startLocationPicker', 'start');
setupLocationPicker('endLocationPicker', 'end');

// Navigation controls
document.getElementById('startNavigation').addEventListener('click', () => {
  if (startMarker && endMarker) {
    updateRoute();
  }
});

document.getElementById('clearRoute').addEventListener('click', () => {
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
  
  if (startMarker) {
    map.removeLayer(startMarker);
    startMarker = null;
    document.getElementById('startLocation').value = '';
  }
  
  if (endMarker) {
    map.removeLayer(endMarker);
    endMarker = null;
    document.getElementById('endLocation').value = '';
  }
});

// Recenter map to user's location
document.getElementById('recenterButton').addEventListener('click', () => {
  if (userLat && userLng) {
    map.setView([userLat, userLng], 16);
  }
});