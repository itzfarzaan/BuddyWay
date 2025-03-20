const socket = io("https://buddyway.onrender.com");

// Add this to store your own socket ID
let userId = socket.id;
let userMarker = null;
let userLat = 0;
let userLng = 0;
let firstUpdate = true;
let userHasScrolled = false; // Track if user has manually moved the map
const markers = {};

const map = L.map("map").setView([0, 0], 10);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "BuddyWay"
}).addTo(map);

// Detect ANY map interaction
map.on('dragstart', function() {
  userHasScrolled = true;
});

// Add zoom detection
map.on('zoomstart', function() {
  userHasScrolled = true;
});

// Also detect touch events for mobile pinch zooming
map.on('touchstart', function() {
  userHasScrolled = true;
});


if (navigator.geolocation) {
  navigator.geolocation.watchPosition((position) => {
    userLat = position.coords.latitude;
    userLng = position.coords.longitude;

    // Only center map on first position update
    if (firstUpdate) {
      map.setView([userLat, userLng], 16);
      firstUpdate = false;
    }

    socket.emit("send-location", { latitude: userLat, longitude: userLng });
  }, (error) => {
    console.error(error);
  }, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });
}

// Get socket ID when connected
socket.on("connect", () => {
  userId = socket.id;
  console.log("Connected with ID:", userId);
});

socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;
  
  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);  // Update existing marker
  } else {
    markers[id] = L.marker([latitude, longitude])  // Create a new marker
      .addTo(map)
      .bindPopup(`User: ${id}`)
      .openPopup();
  }

  // Only auto-center if it's your own marker AND user hasn't scrolled
  if (id === userId && !userHasScrolled) {
    map.setView([latitude, longitude], 16);
  }
});

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});

recenterButton.addEventListener("click", () => {
  if (userLat && userLng) {
    map.setView([userLat, userLng], 16);
    userHasScrolled = false; // Reset the scroll state on manual recenter
  }
});