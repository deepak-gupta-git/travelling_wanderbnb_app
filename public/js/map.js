mapboxgl.accessToken = 'pk.eyJ1IjoidGhlY2xhc3Nyb29tIiwiYSI6ImNscnJ6dXo4ajAxYTMya3A0NG55cW1pMjYifQ.oLJ-X878O9NJFYwI_rwiLQ';
  
const map = new mapboxgl.Map({
container: "map", // container ID
center: coordinates, // starting position [lng, lat]
zoom: 8 // starting zoom
});

console.log(coordinates);

const marker = new mapboxgl.Marker({color : "red"})
.setLngLat(coordinates)
.addTo(map);
