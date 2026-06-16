<script setup lang="ts">
import { cn } from '@/lib/utils';

const model = defineModel<string | null>();
defineProps<{ options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean; class?: string }>();
</script>

<template>
  <select
    :value="model ?? ''"
    :disabled="disabled"
    @change="model = ($event.target as HTMLSelectElement).value || null"
    :class="cn('flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', $props.class)"
  >
    <option v-if="placeholder" value="">{{ placeholder }}</option>
    <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
</template>
