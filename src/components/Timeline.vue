<template>
  <div class="timeline">
    <input
        type="range"
        min="0"
        :max="steps.length - 1"
        v-model="index"
        @input="update"
    />
    <p>{{ steps[index].label }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['change'])

const steps = [
  { label: "Day 1 - Nantes" },
  { label: "Day 2 - Bordeaux" },
  { label: "Day 3 - Spain" },
  { label: "Day 4 - Algeciras" },
  { label: "Day 5 - Ferry" },
  { label: "Day 6 - Rabat" },
  { label: "Day 7 - Desert" },
  { label: "Day 8 - Marrakech" }
]

const index = ref(0)

function update() {
  emit('change', index.value)
}
</script>