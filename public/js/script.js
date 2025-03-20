// Initialize socket connection and store the user’s socket ID
const socket = io("https://buddyway.onrender.com"); 
// const socket = io(); 
let userId = socket.id;
let userLat = 0;
let userLng = 0;
let firstUpdate = true;
let userHasScrolled = false;
const markers = {};
const nameID = [];

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

    socket.emit("send-location", { latitude: userLat, longitude: userLng });
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
  var name = prompt("Enter your name: ");
  userId = socket.id;

  nameID.push({ name: name, id: socket.id });

  console.log("Connected with Name:", name, "ID:", userId,);
});

// Handle receiving location updates from other users and update their markers
socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;
  
  var localName = "";
  for (let i = 0; i < nameID.length; i++){
    if (nameID[i].id === id) {
      localName = nameID[i].name;
      break;
    }
    else {
      localName = "Not Found";
    }
  }

  // Update or add new marker for the user
  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
  } else {
    markers[id] = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(`User: ${localName}`)
      .openPopup();
  }

  // Auto-center map if the marker belongs to the current user and they haven't manually scrolled
  if (id === userId && !userHasScrolled) {
    map.setView([latitude, longitude], 16);
  }
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