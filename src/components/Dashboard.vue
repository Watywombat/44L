<template>
  <div class="dashboard">
    <div>Distance: {{ distance }} km</div>
    <div>Fuel: {{ fuel }} L</div>
    <div>Stage: {{ stage }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['step'])

const distance = computed(() => props.step * 800)
const fuel = computed(() => props.step * 60)
const stage = computed(() => props.step + 1)
</script>