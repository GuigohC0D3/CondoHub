<script setup lang="ts">
import EmptyState from './EmptyState.vue';

export interface Column {
  key: string;
  label: string;
  class?: string;
}

defineProps<{
  columns: Column[];
  rows: Record<string, unknown>[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey?: string;
}>();
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <table class="w-full text-sm">
      <thead class="bg-muted/50 text-left text-muted-foreground">
        <tr>
          <th v-for="c in columns" :key="c.key" class="px-4 py-3 font-medium" :class="c.class">{{ c.label }}</th>
          <th v-if="$slots.actions" class="px-4 py-3 text-right font-medium">Ações</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="n in (loading ? 5 : 0)" :key="`sk-${n}`" class="border-t">
          <td v-for="c in columns" :key="c.key" class="px-4 py-3">
            <div class="h-4 w-full max-w-[140px] animate-pulse rounded bg-muted" />
          </td>
          <td v-if="$slots.actions" class="px-4 py-3">
            <div class="ml-auto h-4 w-12 animate-pulse rounded bg-muted" />
          </td>
        </tr>
        <tr
          v-for="(row, i) in (loading ? [] : rows)" :key="(rowKey ? String(row[rowKey]) : String(i))"
          class="border-t transition-colors hover:bg-muted/30"
        >
          <td v-for="c in columns" :key="c.key" class="px-4 py-3" :class="c.class">
            <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">{{ row[c.key] }}</slot>
          </td>
          <td v-if="$slots.actions" class="px-4 py-3 text-right">
            <div class="flex justify-end gap-1">
              <slot name="actions" :row="row" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <EmptyState v-if="!loading && rows.length === 0" :message="emptyMessage" />
  </div>
</template>
