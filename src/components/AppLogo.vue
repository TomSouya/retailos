<script setup>
defineProps({
  size: { type: Number, default: 34 },
  tone: { type: String, default: 'dark' },
  showText: { type: Boolean, default: true },
  subtitle: { type: String, default: '智慧零售运营平台' },
})
</script>

<template>
  <div class="app-logo" :class="`is-${tone}`">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect class="mark-bg" width="32" height="32" rx="9" />
      <path
        class="mark-line"
        d="M9.5 10.5h13M9.5 16h13M9.5 21.5h8.5"
        stroke-width="2.2"
        stroke-linecap="round"
      />
      <circle class="mark-dot" cx="23.5" cy="21.5" r="3" />
    </svg>
    <div v-if="showText" class="logo-type">
      <span class="logo-name">RetailOS</span>
      <span class="logo-sub">{{ subtitle }}</span>
    </div>
  </div>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.is-dark {
  color: var(--ink);
}

.is-light {
  color: #ffffff;
}

.is-dark .mark-bg {
  fill: var(--ink);
}

.is-dark .mark-line {
  stroke: #ffffff;
}

.is-light .mark-bg {
  fill: #ffffff;
}

.is-light .mark-line {
  stroke: var(--graphite);
}

.mark-dot {
  fill: var(--accent);
}

.logo-type {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.logo-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.logo-sub {
  color: var(--muted);
  font-family: var(--sans);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.4;
  white-space: nowrap;
}

.is-light .logo-sub {
  color: rgba(255, 255, 255, 0.44);
}
</style>
