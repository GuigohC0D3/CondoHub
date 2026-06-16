<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Camera } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

const emit = defineEmits<{ capture: [string]; error: [string] }>();
const video = ref<HTMLVideoElement | null>(null);
let stream: MediaStream | null = null;

onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (video.value) { video.value.srcObject = stream; await video.value.play(); }
  } catch {
    emit('error', 'Não foi possível acessar a câmera.');
  }
});

onBeforeUnmount(() => stream?.getTracks().forEach((t) => t.stop()));

/** Captura um frame reduzido (máx 480px) como JPEG data URL. */
function capture() {
  const v = video.value;
  if (!v || !v.videoWidth) return;
  const scale = Math.min(1, 480 / v.videoWidth);
  const w = Math.round(v.videoWidth * scale);
  const h = Math.round(v.videoHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(v, 0, 0, w, h);
  emit('capture', canvas.toDataURL('image/jpeg', 0.6));
}
</script>

<template>
  <div class="space-y-2">
    <div class="overflow-hidden rounded-md border bg-black">
      <video ref="video" class="aspect-video w-full object-cover" playsinline muted></video>
    </div>
    <Button type="button" variant="outline" class="w-full" @click="capture">
      <Camera class="h-4 w-4" /> Capturar foto
    </Button>
  </div>
</template>
