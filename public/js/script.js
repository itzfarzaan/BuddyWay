// Initialize socket connection
let userId = null; // Initialize as null, will be set when joining session
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
  // Don't set userId here, it will be set when joining session
});

// Session variables
let currentSession = null;
let isHost = false;
let sessionMembers = {};

// Member routes tracking
const memberRoutes = {};
const memberColors = {};
let colorIndex = 1;

// Common destination
let hasCommonDestination = false;
let commonDestination = null;
let commonDestinationActive = false; // Track if common destination mode is active

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
    userId = sessionData.userId;
    isHost = sessionData.isHost;
    
    console.log("Session info loaded from localStorage:", {
      currentSession,
      myName,
      userId,
      isHost
    });
    
    // Update UI
    document.getElementById('sessionCodeDisplay').textContent = currentSession;
    if (isHost) {
      document.body.classList.add('is-host');
    } else {
      document.body.classList.remove('is-host');
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

// Assign a unique color to a member
function assignMemberColor(memberId) {
  if (!memberColors[memberId]) {
    memberColors[memberId] = colorIndex;
    colorIndex = (colorIndex % 8) + 1; // Cycle through 8 colors
  }
  return memberColors[memberId];
}

// Get color for a member
function getMemberColor(memberId) {
  const colorNum = memberColors[memberId] || assignMemberColor(memberId);
  return `color-${colorNum}`;
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
    icon.className = `member-icon ${getMemberColor(memberId)}`;
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
    
    // Create member actions
    const actions = document.createElement('div');
    actions.className = 'member-actions';
    
    // Only add action buttons for other members
    if (memberId !== userId) {
      // Recenter button
      const recenterBtn = document.createElement('button');
      recenterBtn.className = 'member-action-btn recenter-to';
      recenterBtn.title = `Center map on ${member.name}`;
      recenterBtn.innerHTML = '<i class="fas fa-crosshairs"></i>';
      recenterBtn.addEventListener('click', () => {
        if (markers[memberId]) {
          const pos = markers[memberId].getLatLng();
          if (pos && typeof pos.lat === 'function' && typeof pos.lng === 'function') {
            map.setView([pos.lat(), pos.lng()], 16);
          } else if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number') {
            map.setView([pos.lat, pos.lng], 16);
          } else {
            console.error("Invalid marker position for member:", memberId);
          }
        }
      });
      
      // Navigate to button
      const navigateBtn = document.createElement('button');
      navigateBtn.className = 'member-action-btn navigate-to';
      navigateBtn.title = `Navigate to ${member.name}`;
      navigateBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
      navigateBtn.addEventListener('click', () => {
        if (markers[memberId]) {
          const pos = markers[memberId].getLatLng();
          
          // Set as end point
          document.getElementById('endLocation').value = `${member.name}'s location`;
          
          if (endMarker) {
            endMarker.setLatLng(pos);
          } else {
            endMarker = L.marker(pos, {
              draggable: true
            }).addTo(map);
            
            endMarker.on('dragend', function(e) {
              const newPos = e.target.getLatLng();
              document.getElementById('endLocation').value = `${newPos.lat.toFixed(6)}, ${newPos.lng.toFixed(6)}`;
              updateRoute();
            });
          }
          
          // Update route
          updateRoute();
        }
      });
      
      actions.appendChild(recenterBtn);
      actions.appendChild(navigateBtn);
    }
    
    li.appendChild(icon);
    li.appendChild(name);
    li.appendChild(actions);
    membersList.appendChild(li);
  });
}

// Handle connection
socket.on("connect", () => {
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

// When session is joined
socket.on("session-joined", (data) => {
  console.log("Session joined:", data);
  
  // Set session variables
  currentSession = data.sessionCode;
  userId = data.id;
  myName = data.name;
  isHost = data.isHost;
  
  console.log("Session variables set - isHost:", isHost, "userId:", userId);
  
  // Update UI
  document.getElementById('sessionCodeDisplay').textContent = currentSession;
  if (isHost) {
    document.body.classList.add('is-host');
  } else {
    document.body.classList.remove('is-host');
  }
  
  // Update members list
  for (const memberId in data.members) {
    const member = data.members[memberId];
    sessionMembers[memberId] = member;
    
    // Add to members list
    addMemberToList(memberId, member);
  }
  
  // Start location tracking
  setupLocationTracking();
  
  // Setup location pickers
  setupLocationPicker('pickStartLocation', 'start');
  setupLocationPicker('pickEndLocation', 'end');
  
  // Show success toast
  showToast(`Joined session: ${currentSession}`, 3000);
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
    
    // Update marker color class
    const colorClass = getMemberColor(id);
    markers[id].getElement().classList.forEach(cls => {
      if (cls.startsWith('color-')) {
        markers[id].getElement().classList.remove(cls);
      }
    });
    markers[id].getElement().classList.add(colorClass);
    
    markers[id].getPopup().setContent(`User: ${displayName}`);
  } else {
    // Create marker with color
    const colorClass = getMemberColor(id);
    markers[id] = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(`User: ${displayName}`);
    
    // Add color class to marker
    markers[id].getElement().classList.add(colorClass);
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
    
    // Remove any routes for this member
    if (memberRoutes[id]) {
      map.removeControl(memberRoutes[id]);
      delete memberRoutes[id];
    }
    
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

// Handle common destination updates
socket.on("common-destination-update", (data) => {
  console.log("Received common-destination-update:", data);
  
  if (data.sessionCode !== currentSession) return;
  
  if (data.destination) {
    commonDestination = data.destination;
    hasCommonDestination = true;
    commonDestinationActive = data.active || false;
    
    console.log("Common destination updated:", commonDestination, "Active:", commonDestinationActive);
    
    // Show notification for non-hosts
    if (!isHost) {
      document.getElementById('commonDestinationNotification').style.display = 'block';
      showToast("Host has set a common destination for all members", 3000);
      
      // If toggle is active, force update the end marker for non-hosts
      if (commonDestinationActive) {
        console.log("Applying common destination for non-host");
        
        // Set end location input
        document.getElementById('endLocation').value = 'Common Destination';
        
        // Create or update end marker
        if (endMarker) {
          endMarker.setLatLng([commonDestination.lat, commonDestination.lng]);
        } else {
          endMarker = L.marker([commonDestination.lat, commonDestination.lng], {
            draggable: false // Non-hosts cannot move the common destination
          }).addTo(map);
        }
        
        // Update route with current location as start
        if (userLat && userLng) {
          if (startMarker) {
            startMarker.setLatLng([userLat, userLng]);
          } else {
            startMarker = L.marker([userLat, userLng], {
              draggable: false
            }).addTo(map);
          }
          document.getElementById('startLocation').value = 'My Location';
        }
        
        // Update route
        updateRoute();
      }
    } else {
      // For host, update the toggle state
      if (document.getElementById('commonDestinationToggle')) {
        document.getElementById('commonDestinationToggle').checked = commonDestinationActive;
      }
      
      // Create or update end marker for host
      if (endMarker) {
        endMarker.setLatLng([commonDestination.lat, commonDestination.lng]);
      } else {
        endMarker = L.marker([commonDestination.lat, commonDestination.lng], {
          draggable: true // Host can always move the marker
        }).addTo(map);
        
        endMarker.on('dragend', function(e) {
          const pos = e.target.getLatLng();
          commonDestination = pos;
          
          // Update common destination for all members
          socket.emit("set-common-destination", {
            sessionCode: currentSession,
            hostId: userId,
            destination: pos,
            active: commonDestinationActive
          });
          
          updateRoute();
        });
      }
      
      // Update end location input
      document.getElementById('endLocation').value = 'Common Destination';
    }
  } else {
    // Common destination cleared
    hasCommonDestination = false;
    commonDestination = null;
    commonDestinationActive = false;
    
    // Update toggle state for host
    if (isHost && document.getElementById('commonDestinationToggle')) {
      document.getElementById('commonDestinationToggle').checked = false;
    }
    
    // Hide notification for non-hosts
    if (!isHost) {
      document.getElementById('commonDestinationNotification').style.display = 'none';
      showToast("Host has cleared the common destination", 3000);
      
      // Clear route if it was using common destination
      if (document.getElementById('endLocation').value === 'Common Destination') {
        document.getElementById('endLocation').value = '';
        if (endMarker) {
          map.removeLayer(endMarker);
          endMarker = null;
        }
        if (routingControl) {
          map.removeControl(routingControl);
          routingControl = null;
        }
      }
      
      // Make start marker draggable again
      if (startMarker) {
        startMarker.dragging.enable();
      }
    }
  }
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

    // Create route with user's color
    const colorClass = getMemberColor(userId);
    const colorMatch = colorClass.match(/color-(\d+)/);
    let routeColor = '#4285f4'; // Default blue
    
    // Map color class to hex color
    if (colorMatch) {
      const colorMap = {
        '1': '#4285f4', // Blue
        '2': '#0f9d58', // Green
        '3': '#f4b400', // Yellow
        '4': '#db4437', // Red
        '5': '#673ab7', // Purple
        '6': '#ff6d00', // Orange
        '7': '#00bcd4', // Cyan
        '8': '#795548'  // Brown
      };
      routeColor = colorMap[colorMatch[1]] || routeColor;
    }

    routingControl = L.Routing.control({
      waypoints: [
        L.latLng(start.lat, start.lng),
        L.latLng(end.lat, end.lng)
      ],
      routeWhileDragging: true,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false, // Don't auto-fit to avoid map jumping
      lineOptions: {
        styles: [{ color: routeColor, weight: 6, opacity: 0.8 }]
      },
      show: false
    }).addTo(map);
    
    // Share route with other members
    if (currentSession) {
      // Inform others that we have a route
      socket.emit("member-has-route", {
        sessionCode: currentSession,
        userId: userId,
        hasRoute: true,
        startPoint: {
          lat: start.lat,
          lng: start.lng
        },
        endPoint: {
          lat: end.lat,
          lng: end.lng
        }
      });
    }
  }
}

// Location picker functionality
function setupLocationPicker(inputId, markerId) {
  const button = document.getElementById(inputId);
  const input = button.previousElementSibling;

  button.addEventListener('click', () => {
    // Don't allow changing end location if common destination is active and user is not host
    if (commonDestinationActive && !isHost && markerId === 'end') {
      showToast("The host has set a common destination for all members", 3000);
      return;
    }
    
    // Don't allow changing start location if common destination is active (for anyone)
    if (commonDestinationActive && markerId === 'start' && !isHost) {
      showToast("In common destination mode, your current location is always used as the starting point", 3000);
      return;
    }
    
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
            draggable: !commonDestinationActive || isHost // Only draggable if common destination is not active or is host
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
            draggable: !commonDestinationActive || isHost // Only draggable if common destination is not active or is host
          }).addTo(map);
          
          endMarker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            input.value = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
            updateRoute();
          });
        }
        
        // If host is setting end point and common destination is active, update it for all
        if (isHost && commonDestinationActive) {
          commonDestination = { lat, lng };
          socket.emit("set-common-destination", {
            sessionCode: currentSession,
            hostId: userId,
            destination: { lat, lng },
            active: commonDestinationActive
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

// Set current location as start point
document.getElementById('setCurrentLocationAsStart').addEventListener('click', () => {
  // Always allow setting current location as start point
  if (userLat && userLng) {
    document.getElementById('startLocation').value = 'My Location';
    
    if (startMarker) {
      startMarker.setLatLng([userLat, userLng]);
    } else {
      startMarker = L.marker([userLat, userLng], {
        draggable: !commonDestinationActive || isHost // Only draggable if common destination is not active or is host
      }).addTo(map);
      
      startMarker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        document.getElementById('startLocation').value = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
        updateRoute();
      });
    }
    
    updateRoute();
  }
});

// Navigation controls
document.getElementById('startNavigation').addEventListener('click', () => {
  if (commonDestinationActive && !isHost) {
    // For non-hosts in common destination mode, always use current location as start
    if (userLat && userLng && commonDestination) {
      if (startMarker) {
        startMarker.setLatLng([userLat, userLng]);
      } else {
        startMarker = L.marker([userLat, userLng], {
          draggable: false
        }).addTo(map);
      }
      
      if (endMarker) {
        endMarker.setLatLng([commonDestination.lat, commonDestination.lng]);
      } else {
        endMarker = L.marker([commonDestination.lat, commonDestination.lng], {
          draggable: false
        }).addTo(map);
      }
      
      document.getElementById('startLocation').value = 'My Location';
      document.getElementById('endLocation').value = 'Common Destination';
      
      updateRoute();
    } else {
      showToast("Waiting for host to set a destination", 3000);
    }
  } else if (startMarker && endMarker) {
    updateRoute();
  } else {
    showToast("Please set both start and end points", 3000);
  }
});

document.getElementById('clearRoute').addEventListener('click', () => {
  // Don't allow clearing if common destination is active and user is not host
  if (commonDestinationActive && !isHost) {
    showToast("The host has set a common destination for all members", 3000);
    return;
  }
  
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
  
  if (startMarker && (!commonDestinationActive || isHost)) {
    map.removeLayer(startMarker);
    startMarker = null;
    document.getElementById('startLocation').value = '';
  }
  
  if (endMarker && (!commonDestinationActive || isHost)) {
    map.removeLayer(endMarker);
    endMarker = null;
    document.getElementById('endLocation').value = '';
  }
});

// Host-only common destination toggle
if (document.getElementById('commonDestinationToggle')) {
  document.getElementById('commonDestinationToggle').addEventListener('change', function() {
    if (!isHost) return;
    
    commonDestinationActive = this.checked;
    
    if (commonDestinationActive) {
      // If toggle is turned on but no destination is set
      if (!commonDestination && endMarker) {
        commonDestination = endMarker.getLatLng();
      }
      
      if (commonDestination) {
        socket.emit("set-common-destination", {
          sessionCode: currentSession,
          hostId: userId,
          destination: commonDestination,
          active: true
        });
        showToast("Common destination mode activated for all members", 3000);
      } else {
        showToast("Please set a destination first", 3000);
        this.checked = false;
        commonDestinationActive = false;
      }
    } else {
      // If toggle is turned off, keep the destination but deactivate common mode
      if (commonDestination) {
        socket.emit("set-common-destination", {
          sessionCode: currentSession,
          hostId: userId,
          destination: commonDestination,
          active: false
        });
        showToast("Common destination mode deactivated", 3000);
      }
    }
  });
}

// Remove event listeners for buttons we removed from the UI
// But keep the functionality in case they're added back later
if (document.getElementById('setCommonDestination')) {
  document.getElementById('setCommonDestination').addEventListener('click', () => {
    if (!isHost) return;
    
    if (endMarker) {
      const pos = endMarker.getLatLng();
      commonDestination = pos;
      socket.emit("set-common-destination", {
        sessionCode: currentSession,
        hostId: userId,
        destination: pos,
        active: commonDestinationActive
      });
      showToast("Common destination set for all members", 3000);
      
      // If toggle is on, make sure it stays on
      if (document.getElementById('commonDestinationToggle')) {
        document.getElementById('commonDestinationToggle').checked = commonDestinationActive;
      }
    } else {
      showToast("Please select a destination first", 3000);
    }
  });
}

if (document.getElementById('clearCommonDestination')) {
  document.getElementById('clearCommonDestination').addEventListener('click', () => {
    if (!isHost) return;
    
    socket.emit("clear-common-destination", {
      sessionCode: currentSession,
      hostId: userId
    });
    
    commonDestination = null;
    hasCommonDestination = false;
    commonDestinationActive = false;
    
    // Update toggle state
    if (document.getElementById('commonDestinationToggle')) {
      document.getElementById('commonDestinationToggle').checked = false;
    }
    
    showToast("Common destination cleared", 3000);
  });
}

// Mobile panel toggles - improved for better UX
document.getElementById('navigationToggle').addEventListener('click', () => {
  document.body.classList.toggle('navigation-collapsed');
  const icon = document.querySelector('#navigationToggle i');
  if (document.body.classList.contains('navigation-collapsed')) {
    icon.className = 'fas fa-chevron-down';
  } else {
    icon.className = 'fas fa-chevron-up';
  }
  
  // If opening navigation panel, close members panel
  if (!document.body.classList.contains('navigation-collapsed')) {
    document.body.classList.add('members-collapsed');
    document.querySelector('#membersToggle i').className = 'fas fa-chevron-up';
  }
});

document.getElementById('membersToggle').addEventListener('click', () => {
  document.body.classList.toggle('members-collapsed');
  const icon = document.querySelector('#membersToggle i');
  if (document.body.classList.contains('members-collapsed')) {
    icon.className = 'fas fa-chevron-up';
  } else {
    icon.className = 'fas fa-chevron-down';
  }
  
  // If opening members panel, close navigation panel
  if (!document.body.classList.contains('members-collapsed')) {
    document.body.classList.add('navigation-collapsed');
    document.querySelector('#navigationToggle i').className = 'fas fa-chevron-down';
  }
});

// Recenter map to user's location
document.getElementById('recenterButton').addEventListener('click', () => {
  if (userLat && userLng) {
    map.setView([userLat, userLng], 16);
  }
});