<script setup lang="ts">
const shapes: Record<string,string> = {
  scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 20 19M8.5 16.5 20 5M11 12h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  gallery:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>',
  analysis:'<path d="M9 4H6a2 2 0 0 0-2 2v3m11-5h3a2 2 0 0 1 2 2v3M9 20H6a2 2 0 0 1-2-2v-3m11 5h3a2 2 0 0 0 2-2v-3"/><path d="M9 10h.01m6 0h.01M9 14a4 4 0 0 0 6 0"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/>',
  spark:'<path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Zm6 14 1 2.9 3 1.1-3 1-1 3-1-3-3-1 3-1.1 1-2.9Z"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  down:'<path d="m7 10 5 5 5-5"/>',
  photo:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 5"/><circle cx="16" cy="9" r="1"/>',
  report:'<path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm6 0v5h5M8 12h7m-7 4h7"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external:'<path d="M13 5h6v6m0-6-9 9m7-1v5H6V7h5"/>',
  edit:'<path d="m14 5 5 5M5 19l4-1L20 7l-4-4L5 14l-1 6Z"/>',
  shield:'<path d="M12 3 4.5 6v5.5c0 4.5 2.4 7.3 7.5 9.5 5.1-2.2 7.5-5 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  pin:'<path d="M7 4h10v16l-5-3-5 3z"/>',
  reload:'<path d="M19 10a7 7 0 1 0 .1 4M19 5v5h-5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  settings:'<path d="M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  expand:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  outline:'<path d="M8 21v-3c-2.4-1.5-3.7-4-3.7-7.1 0-4.4 2.8-7.8 7.4-7.8 4.5 0 7.8 3.1 7.8 7.5 0 1.5-.3 2.5-1 3.6m-1.2 4.3V21M5 10c4-1 7-3 8.3-5.3 1.4 2.8 3.5 4.2 6.2 4.8M11 14h.01"/>',
};
const props=withDefaults(defineProps<{name:string;size?:number}>(),{size:19});
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="shapes[props.name] || shapes.photo"></svg>
</template>
