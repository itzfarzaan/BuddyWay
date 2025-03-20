const socket = io("https://buddyway.onrender.com");

const map = L.map("map").setView([0, 0], 10);

if (navigator.geolocation) {
  navigator.geolocation.watchPosition((position) => {
    const { latitude, longitude } = position.coords;

    if (map.getCenter().lat === 0 && map.getCenter().lng === 0) {
      map.setView([latitude, longitude], 16);
    }

    socket.emit("send-location", { latitude, longitude });
  }, (error) => {
    console.error(error);
  },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    });
}



L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "BuddyWay"
}).addTo(map);

const markers = {};
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

  map.setView([latitude, longitude], 16);
});

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});