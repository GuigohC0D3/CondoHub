<script setup lang="ts">
import { computed } from 'vue';
import Modal from './Modal.vue';
import { Button } from './button';
import { confirmState, settleConfirm } from '@/lib/confirm';

const open = computed({
  get: () => confirmState.open,
  set: (v: boolean) => { if (!v) settleConfirm(false); },
});
</script>

<template>
  <Modal v-model:open="open" :title="confirmState.title" :description="confirmState.message">
    <template #footer>
      <Button variant="outline" @click="settleConfirm(false)">{{ confirmState.cancelLabel }}</Button>
      <Button :variant="confirmState.destructive ? 'destructive' : 'default'" @click="settleConfirm(true)">
        {{ confirmState.confirmLabel }}
      </Button>
    </template>
  </Modal>
</template>
