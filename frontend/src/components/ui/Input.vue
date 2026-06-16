<script setup lang="ts">
import { cn } from '@/lib/utils';

const model = defineModel<string | number | null>();
defineProps<{ type?: string; placeholder?: string; disabled?: boolean; class?: string; step?: string }>();
</script>

<template>
  <input
    :type="type ?? 'text'"
    :value="model"
    :placeholder="placeholder"
    :disabled="disabled"
    :step="step"
    @input="model = ($event.target as HTMLInputElement).value"
    :class="cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', $props.class)"
  />
</template>
