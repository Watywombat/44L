<template>
  <l-map ref="mapRef" v-if="latlngs.length" :zoom="6" :center="milestones[0].coords" style="height: 100%; width: 100%; border-radius: 12px; z-index: 1;">

    <l-tile-layer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap &copy; CARTO"
    />

    <l-polyline :lat-lngs="latlngs" color="#E63946" :weight="4" dash-array="8, 12" opacity="0.7" />

    <l-marker :lat-lng="currentPosition" :icon="carIcon">
      <l-popup>
        <strong style="color: #2D1E42; font-family: 'Oswald', sans-serif; font-size: 16px; text-transform: uppercase;">
          {{ currentDayName }}
        </strong>
      </l-popup>
    </l-marker>
  </l-map>
</template>

<script setup>
import { ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import routeData from '../data/route.json'
import { LMap, LTileLayer, LMarker, LPolyline, LPopup } from "@vue-leaflet/vue-leaflet"

const mapRef = ref(null)

// Tracé de la ligne continue (géométrie complète)
const latlngs = routeData.geometry.coordinates.map(c => [c[1], c[0]])

// ─── TES 7 ÉTAPES OFFICIELLES (Avec coordonnées GPS précises) ───
const milestones = [
  { name: "Nantes",    coords: [47.2184, -1.5536] },
  { name: "Biarritz",  coords: [43.4832, -1.5586] },
  { name: "Algeciras", coords: [36.1408, -5.4562] },
  { name: "Tanger",    coords: [35.7595, -5.8340] },
  { name: "Boulajoul", coords: [33.1678, -4.9547] },
  { name: "Merzouga",  coords: [31.0802, -3.9822] },
  { name: "Marrakech", coords: [31.6295, -7.9811] }
]

const currentPosition = ref(milestones[0].coords)
const currentDayName = ref(milestones[0].name)

const props = defineProps({
  step: { type: Number, default: 0 }
})

// ─── L'ANIMATION FLUIDE ───
watch(() => props.step, (newStep) => {
  // On vérifie que l'étape existe bien dans notre tableau des 7 étapes
  if (milestones[newStep]) {
    const targetCoords = milestones[newStep].coords

    // 1. Déplace la voiture
    currentPosition.value = targetCoords
    currentDayName.value = milestones[newStep].name

    // 2. Fait glisser la caméra (Smooth Pan)
    if (mapRef.value && mapRef.value.leafletObject) {
      mapRef.value.leafletObject.flyTo(targetCoords, 6, {
        animate: true,
        duration: 1.5,
        easeLinearity: 0.25
      })
    }
  }
})

// ─── SVG DE LA 4L ───
const carIcon = L.divIcon({
  className: 'custom-4l-marker',
  html: `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256"><path d="M240,112H211.31L168,68.69A15.86,15.86,0,0,0,156.69,64H44.28A16,16,0,0,0,31,71.12L1.34,115.56A8.07,8.07,0,0,0,0,120v48a16,16,0,0,0,16,16H33a32,32,0,0,0,62,0h66a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V128A16,16,0,0,0,240,112ZM44.28,80H156.69l32,32H23ZM64,192a16,16,0,1,1,16-16A16,16,0,0,1,64,192Zm128,0a16,16,0,1,1,16-16A16,16,0,0,1,192,192Zm48-24H223a32,32,0,0,0-62,0H95a32,32,0,0,0-62,0H16V128H240Z"></path></svg>
  `,
  iconSize: [40, 26],
  iconAnchor: [20, 13],
  popupAnchor: [0, -15]
})
</script>

<style>
/* Animation fluide de la voiture */
.custom-4l-marker {
  background: transparent;
  border: none;
  transition: transform 1.5s cubic-bezier(0.25, 1, 0.5, 1) !important;
}

.vue-leaflet-map {
  width: 100%;
  height: 100% !important;
}
</style>