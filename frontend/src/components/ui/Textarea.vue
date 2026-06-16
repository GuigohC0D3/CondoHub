<script setup lang="ts">
import { cn } from '@/lib/utils';

const model = defineModel<string | null>();
defineProps<{ placeholder?: string; rows?: number; disabled?: boolean; class?: string }>();
</script>

<template>
  <textarea
    :value="model ?? ''"
    :placeholder="placeholder"
    :rows="rows ?? 4"
    :disabled="disabled"
    @input="model = ($event.target as HTMLTextAreaElement).value"
    :class="cn('flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', $props.class)"
  />
</template>
