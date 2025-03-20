const socket = io("https://buddyway.onrender.com");

let userMarker = null;
let userLat = 0;
let userLng = 0;
let firstUpdate = true;
const markers = {};

const map = L.map("map").setView([0, 0], 10);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "BuddyWay"
}).addTo(map);

if (navigator.geolocation) {
  navigator.geolocation.watchPosition((position) => {
    userLat = position.coords.latitude;
    userLng = position.coords.longitude;

    if (firstUpdate) {
      map.setView([userLat, userLng], 16); // Set initial view to user's location
      firstUpdate = false;
    }

    if (!userMarker) {
      userMarker = L.marker([userLat, userLng]).addTo(map);
    } else {
      userMarker.setLatLng([userLat, userLng]);
    }

    socket.emit("send-location", { latitude: userLat, longitude: userLng });
  }, (error) => {
    console.error(error);
  }, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000,
  });
}


socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;

  if (id === socket.id) return; // Ignore own updates
  
  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);  // Update existing marker
  } else {
    markers[id] = L.marker([latitude, longitude])  // Create a new marker
      .addTo(map)
      .bindPopup(`User: ${id}`)
      .openPopup();
  }

  map.setView([latitude, longitude], 16);
});

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});

const recenterButton = document.createElement("button");
recenterButton.innerText = "Recenter";
recenterButton.style.position = "absolute";
recenterButton.style.top = "10px";
recenterButton.style.right = "10px";
recenterButton.style.padding = "10px";
recenterButton.style.background = "white";
recenterButton.style.border = "1px solid black";
recenterButton.style.cursor = "pointer";
document.body.appendChild(recenterButton);

recenterButton.addEventListener("click", () => {
  if (userMarker) {
    map.setView([userLat, userLng], 16);
  }
});