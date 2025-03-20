// Initialize socket connection
const socket = io("https://buddyway.onrender.com");
// const socket = io();
let userId = socket.id;
let userLat = 0;
let userLng = 0;
let firstUpdate = true;
let userHasScrolled = false;
const markers = {};
const userNames = {}; // Object for O(1) lookups instead of array
let myName = "";

// Initialize map
const map = L.map("map").setView([0, 0], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "BuddyWay"
}).addTo(map);

// Detect interaction
map.on('dragstart zoomstart touchstart', function() {
  userHasScrolled = true;
});

// Get location and send to server
if (navigator.geolocation) {
  navigator.geolocation.watchPosition((position) => {
    userLat = position.coords.latitude;
    userLng = position.coords.longitude;

    if (firstUpdate) {
      map.setView([userLat, userLng], 16);
      firstUpdate = false;
    }

    socket.emit("send-location", { latitude: userLat, longitude: userLng, name: myName });
  }, console.error, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });
}

// Handle connection
socket.on("connect", () => {
  myName = prompt("Enter your name: ");
  userId = socket.id;
  userNames[userId] = myName;
  
  socket.emit("user-joined", { id: userId, name: myName });
  console.log("Connected with Name:", myName, "ID:", userId);
});

// Handle location updates
socket.on("receive-location", (data) => {
  const { id, latitude, longitude, name } = data;
  
  // Update name if provided
  if (name) userNames[id] = name;
  
  const displayName = userNames[id] || "Unknown";

  // Update or add marker
  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
    markers[id].getPopup().setContent(`User: ${displayName}`);
  } else {
    markers[id] = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(`User: ${displayName}`)
      .openPopup();
  }

  // Auto-center if needed
  if (id === userId && !userHasScrolled) {
    map.setView([latitude, longitude], 16);
  }
});

// Handle user joined
socket.on("user-joined", (data) => {
  const { id, name } = data;
  userNames[id] = name;
  
  // Share your name with new user
  socket.emit("user-joined", { id: userId, name: myName });
  
  // Update marker popup if exists
  if (markers[id]) {
    markers[id].getPopup().setContent(`User: ${name}`);
  }
});

// Handle disconnection
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
    delete userNames[id];
  }
});

// Recenter button
recenterButton = document.getElementById("recenterButton");
recenterButton.addEventListener("click", () => {
  if (userLat && userLng) {
    map.setView([userLat, userLng], 16);
    userHasScrolled = false;
  }
});