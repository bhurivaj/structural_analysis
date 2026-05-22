<script setup lang="ts">
import AppNavbar from '@/components/ui/AppNavbar.vue'
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-slate-50">
    <AppNavbar />
    <main class="flex-1 overflow-hidden">
      <RouterView />
    </main>
  </div>
</template>
