<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
const props = defineProps<{ variant?: Variant; class?: string }>();

const variants: Record<Variant, string> = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  success: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  destructive: 'border-transparent bg-destructive/15 text-destructive',
  outline: 'text-foreground',
};

const classes = computed(() =>
  cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', variants[props.variant ?? 'default'], props.class),
);
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
