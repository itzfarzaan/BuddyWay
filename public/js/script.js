// Initialize socket connection and store the user’s socket ID
// const socket = io("https://buddyway.onrender.com"); 
const socket = io(); 
let userId = socket.id;
let userLat = 0;
let userLng = 0;
let firstUpdate = true;
let userHasScrolled = false;
const markers = {};
const nameID = [];
let myName = "";

// Initialize and configure the map with Leaflet
const map = L.map("map").setView([0, 0], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "BuddyWay"
}).addTo(map);

// Detect any map interaction and flag if the user has manually scrolled or zoomed
map.on('dragstart', function() {
  userHasScrolled = true;
});
map.on('zoomstart', function() {
  userHasScrolled = true;
});
map.on('touchstart', function() {
  userHasScrolled = true;
});

// Get the user's location and send it to the server
if (navigator.geolocation) {
  navigator.geolocation.watchPosition((position) => {
    userLat = position.coords.latitude;
    userLng = position.coords.longitude;

    // Center map on the user's location only once
    if (firstUpdate) {
      map.setView([userLat, userLng], 16);
      firstUpdate = false;
    }

    socket.emit("send-location", { latitude: userLat, longitude: userLng, name: myName });
  }, (error) => {
    console.error(error);
  }, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });
}

// Get socket ID when connected and log it
socket.on("connect", () => {
  myName = prompt("Enter your name: ");
  userId = socket.id;

  // Add your own name to local nameID array
  nameID.push({ name: myName, id: socket.id });
  
  // Send your name immediately on connection
  socket.emit("user-joined", { id: socket.id, name: myName });
  
  console.log("Connected with Name:", myName, "ID:", userId);
});

// Handle receiving location updates from other users and update their markers
socket.on("receive-location", (data) => {
  const { id, latitude, longitude, name } = data;
  
  // --------------------------------------------
  // ------ DISPLAY NAME ON MARKER CODE ---------
  // --------------------------------------------
  // Update nameID array with the received name
  let found = false;
  for (let i = 0; i < nameID.length; i++) {
    if (nameID[i].id === id) {
      nameID[i].name = name; // Update name if already exists
      found = true;
      break;
    }
  }
  
  // Add new entry if not found
  if (!found && name) {
    nameID.push({ id, name });
  }
  
  // Get the name from the array
  let displayName = "Unknown";
  for (let i = 0; i < nameID.length; i++) {
    if (nameID[i].id === id) {
      displayName = nameID[i].name;
      break;
    }
  } 

  // Update or add new marker for the user
  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
    markers[id].getPopup().setContent(`User: ${displayName}`);
  } else {
    markers[id] = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(`User: ${displayName}`)
      .openPopup();
  }

  // Auto-center map if the marker belongs to the current user and they haven't manually scrolled
  if (id === userId && !userHasScrolled) {
    map.setView([latitude, longitude], 16);
  }
});

// Handle new user joined event
socket.on("user-joined", (data) => {
  const { id, name } = data;
  
  // Add to nameID array if not already present
  let found = false;
  for (let i = 0; i < nameID.length; i++) {
    if (nameID[i].id === id) {
      nameID[i].name = name;
      found = true;
      break;
    }
  }
  
  if (!found) {
    nameID.push({ id, name });
  }
  
  // Send your own name to the new user
  socket.emit("user-joined", { id: userId, name: myName });
});

// Handle user disconnection and remove their marker from the map
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];

  for (let i = 0; i < nameID.length; i++){
    if (nameID[i].id === id) {
      nameID.splice(i, 1);
    }
  }
  }
});

// Manual recenter button click handler
recenterButton = document.getElementById("recenterButton");
recenterButton.addEventListener("click", () => {
  if (userLat && userLng) {
    map.setView([userLat, userLng], 16);
    userHasScrolled = false; // Reset the scroll state on recenter
  }
});