<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import QrScanner from 'qr-scanner';

const emit = defineEmits<{ detect: [string]; error: [string] }>();
const video = ref<HTMLVideoElement | null>(null);
let scanner: QrScanner | null = null;
let done = false;

onMounted(async () => {
  if (!video.value) return;
  try {
    if (!(await QrScanner.hasCamera())) {
      emit('error', 'Nenhuma câmera encontrada neste dispositivo.');
      return;
    }
    scanner = new QrScanner(
      video.value,
      (result) => {
        if (done) return;
        done = true; // dispara uma vez
        emit('detect', result.data);
      },
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
    );
    await scanner.start();
  } catch (e) {
    emit('error', (e as Error)?.message ?? 'Não foi possível acessar a câmera.');
  }
});

onBeforeUnmount(() => {
  scanner?.stop();
  scanner?.destroy();
  scanner = null;
});
</script>

<template>
  <div class="overflow-hidden rounded-md border bg-black">
    <video ref="video" class="aspect-square w-full object-cover"></video>
  </div>
</template>
