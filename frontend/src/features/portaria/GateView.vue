<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { QrCode, LogIn, LogOut, PackagePlus, Check, Camera, X, Ban, PackageIcon } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import QrScanner from '@/components/common/QrScanner.vue';
import CameraCapture from '@/components/common/CameraCapture.vue';
import Card from '@/components/ui/Card.vue';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Label from '@/components/ui/Label.vue';
import Modal from '@/components/ui/Modal.vue';
import { toast, apiError } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { useApartments } from '@/features/structure/api';
import { useVisitors, useVisitorAction, validateQr, type Visitor, type VisitorStatus } from '@/features/visitors/api';
import { usePackages, useCreatePackage, usePickup, type Package, type PackageStatus } from '@/features/packages/api';

const route = useRoute();
const router = useRouter();

// --- QR ---
const qrInput = ref('');
const found = ref<Visitor | null>(null);
const scanning = ref(false);
const visitorAction = useVisitorAction();

/** Aceita o token puro ou a URL `?code=` (do QR ou de uma câmera externa). */
function extractCode(raw: string): string {
  const v = raw.trim();
  const m = v.match(/code=([^&\s]+)/);
  return m ? decodeURIComponent(m[1]) : v;
}
async function checkQr() {
  const code = extractCode(qrInput.value);
  if (!code) return;
  try { found.value = await validateQr(code); }
  catch (e) { found.value = null; toast.error(apiError(e, 'QR inválido')); }
}
function onScan(text: string) {
  scanning.value = false;
  qrInput.value = extractCode(text);
  checkQr();
}
function onScanError(msg: string) {
  scanning.value = false;
  toast.error(msg);
}

// Deep link: porteiro abre o app pela URL do QR (/portaria?code=...).
onMounted(() => {
  const code = route.query.code as string | undefined;
  if (code) {
    qrInput.value = code;
    checkQr();
    router.replace({ query: {} });
  }
});
async function act(id: string, action: 'checkout' | 'deny') {
  try {
    const updated = await visitorAction.mutateAsync({ id, action });
    if (found.value?.id === id) found.value = updated;
    toast.success(action === 'checkout' ? 'Saída registrada' : 'Acesso negado');
  } catch (e) { toast.error(apiError(e)); }
}
async function denyVisitor(v: Visitor) {
  if (!(await confirm({ title: 'Negar acesso', message: `Negar a entrada de ${v.fullName}?`, destructive: true, confirmLabel: 'Negar' }))) return;
  act(v.id, 'deny');
}

// --- Check-in com foto ---
const checkInTarget = ref<Visitor | null>(null);
const capturedPhoto = ref<string | null>(null);
const checkInOpen = computed({ get: () => !!checkInTarget.value, set: (o: boolean) => { if (!o) checkInTarget.value = null; } });
function openCheckIn(v: Visitor) { checkInTarget.value = v; capturedPhoto.value = null; }
async function confirmCheckIn() {
  if (!checkInTarget.value) return;
  const id = checkInTarget.value.id;
  try {
    const updated = await visitorAction.mutateAsync({ id, action: 'checkin', body: capturedPhoto.value ? { photo: capturedPhoto.value } : undefined });
    if (found.value?.id === id) found.value = updated;
    toast.success('Entrada registrada');
    checkInTarget.value = null;
  } catch (e) { toast.error(apiError(e)); }
}

// --- Visitantes ---
const vPage = ref(1);
const { data: visitors, isLoading: lv } = useVisitors(vPage);
const VSTATUS: Record<VisitorStatus, { v: 'warning' | 'success' | 'secondary' | 'destructive'; t: string }> = {
  EXPECTED: { v: 'warning', t: 'Esperado' }, CHECKED_IN: { v: 'success', t: 'Dentro' }, CHECKED_OUT: { v: 'secondary', t: 'Saiu' }, DENIED: { v: 'destructive', t: 'Negado' },
};
const vCols: Column[] = [{ key: 'fullName', label: 'Visitante' }, { key: 'resident', label: 'Morador' }, { key: 'status', label: 'Status' }];
const vRows = computed(() => (visitors.value?.data ?? []) as unknown as Record<string, unknown>[]);

// --- Encomendas ---
const pPage = ref(1);
const { data: packages, isLoading: lp } = usePackages(pPage);
const PSTATUS: Record<PackageStatus, { v: 'warning' | 'secondary' | 'success'; t: string }> = {
  RECEIVED: { v: 'warning', t: 'Recebida' }, NOTIFIED: { v: 'warning', t: 'Notificada' }, PICKED_UP: { v: 'success', t: 'Retirada' },
};
const pCols: Column[] = [{ key: 'photo', label: '', class: 'w-12' }, { key: 'apartment', label: 'Apto' }, { key: 'description', label: 'Descrição' }, { key: 'status', label: 'Status' }];
const pRows = computed(() => (packages.value?.data ?? []) as unknown as Record<string, unknown>[]);
const photoView = ref<string | null>(null);
const photoOpen = computed({ get: () => !!photoView.value, set: (o: boolean) => { if (!o) photoView.value = null; } });

const { data: apts } = useApartments();
const aptOptions = computed(() => (apts.value?.data ?? []).map((a) => ({ value: a.id, label: `${a.block ? a.block.name + ' · ' : ''}${a.number}` })));

const showPkg = ref(false);
const pkgForm = reactive({ apartmentId: '', description: '', carrier: '' });
const pkgPhoto = ref<string | null>(null);
const createPkg = useCreatePackage();
function openPkg() { Object.assign(pkgForm, { apartmentId: '', description: '', carrier: '' }); pkgPhoto.value = null; showPkg.value = true; }
async function submitPkg() {
  try {
    await createPkg.mutateAsync({ apartmentId: pkgForm.apartmentId, description: pkgForm.description || undefined, carrier: pkgForm.carrier || undefined, photo: pkgPhoto.value || undefined });
    toast.success('Encomenda registrada'); showPkg.value = false;
    Object.assign(pkgForm, { apartmentId: '', description: '', carrier: '' });
    pkgPhoto.value = null;
  } catch (e) { toast.error(apiError(e)); }
}

const pickup = usePickup();
async function doPickup(id: string) {
  const name = prompt('Nome de quem retirou:');
  if (!name) return;
  try { await pickup.mutateAsync({ id, pickedUpBy: name }); toast.success('Retirada confirmada'); }
  catch (e) { toast.error(apiError(e)); }
}
</script>

<template>
  <div>
    <PageHeader title="Portaria" subtitle="Controle de visitantes e encomendas" />

    <Card class="mb-6 p-4">
      <h2 class="mb-3 flex items-center gap-2 font-medium"><QrCode class="h-4 w-4" /> Validar QR de visitante</h2>

      <div v-if="scanning" class="mb-3 max-w-xs">
        <QrScanner @detect="onScan" @error="onScanError" />
        <Button variant="outline" size="sm" class="mt-2 w-full" @click="scanning = false"><X class="h-4 w-4" /> Fechar câmera</Button>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button v-if="!scanning" variant="default" @click="scanning = true"><Camera class="h-4 w-4" /> Escanear com a câmera</Button>
        <form class="flex flex-1 gap-2" @submit.prevent="checkQr">
          <Input v-model="qrInput" placeholder="...ou cole o código manualmente" class="max-w-md" />
          <Button type="submit" variant="outline">Validar</Button>
        </form>
      </div>
      <div v-if="found" class="mt-3 flex flex-wrap items-center gap-3 rounded-md border p-3">
        <img v-if="found.photoUrl" :src="found.photoUrl" alt="Foto" class="h-12 w-12 rounded-md object-cover" />
        <div>
          <div class="font-medium">{{ found.fullName }}</div>
          <div class="text-sm text-muted-foreground">Visita a {{ found.resident.fullName }}</div>
        </div>
        <Badge :variant="VSTATUS[found.status].v">{{ VSTATUS[found.status].t }}</Badge>
        <div class="ml-auto flex gap-2">
          <template v-if="found.status === 'EXPECTED'">
            <Button size="sm" @click="openCheckIn(found)"><LogIn class="h-4 w-4" /> Entrada</Button>
            <Button size="sm" variant="destructive" @click="denyVisitor(found)"><Ban class="h-4 w-4" /> Negar</Button>
          </template>
          <Button v-if="found.status === 'CHECKED_IN'" size="sm" variant="outline" @click="act(found.id, 'checkout')"><LogOut class="h-4 w-4" /> Saída</Button>
        </div>
      </div>
    </Card>

    <div class="grid gap-6 lg:grid-cols-2">
      <Card class="p-4">
        <h2 class="mb-3 font-medium">Visitantes recentes</h2>
        <DataTable :columns="vCols" :rows="vRows" :loading="lv" row-key="id" empty-message="Sem visitantes.">
          <template #cell-resident="{ row }">{{ (row as unknown as Visitor).resident.fullName }}</template>
          <template #cell-status="{ value }"><Badge :variant="VSTATUS[value as VisitorStatus].v">{{ VSTATUS[value as VisitorStatus].t }}</Badge></template>
          <template #actions="{ row }">
            <template v-if="(row as unknown as Visitor).status === 'EXPECTED'">
              <Button size="sm" variant="ghost" title="Entrada" @click="openCheckIn(row as unknown as Visitor)"><LogIn class="h-4 w-4 text-emerald-600" /></Button>
              <Button size="sm" variant="ghost" title="Negar" @click="denyVisitor(row as unknown as Visitor)"><Ban class="h-4 w-4 text-destructive" /></Button>
            </template>
            <Button v-if="(row as unknown as Visitor).status === 'CHECKED_IN'" size="sm" variant="ghost" title="Saída" @click="act((row as any).id, 'checkout')"><LogOut class="h-4 w-4" /></Button>
          </template>
        </DataTable>
      </Card>

      <Card class="p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-medium">Encomendas</h2>
          <Button size="sm" @click="openPkg"><PackagePlus class="h-4 w-4" /> Registrar</Button>
        </div>
        <DataTable :columns="pCols" :rows="pRows" :loading="lp" row-key="id" empty-message="Sem encomendas.">
          <template #cell-photo="{ row }">
            <button v-if="(row as unknown as Package).photoUrl" type="button" @click="photoView = (row as unknown as Package).photoUrl">
              <img :src="(row as unknown as Package).photoUrl!" alt="" class="h-9 w-9 rounded-md object-cover" />
            </button>
            <span v-else class="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground"><PackageIcon class="h-4 w-4" /></span>
          </template>
          <template #cell-apartment="{ row }">{{ (row as unknown as Package).apartment.number }}</template>
          <template #cell-description="{ value }">{{ value ?? 'Encomenda' }}</template>
          <template #cell-status="{ value }"><Badge :variant="PSTATUS[value as PackageStatus].v">{{ PSTATUS[value as PackageStatus].t }}</Badge></template>
          <template #actions="{ row }">
            <Button v-if="(row as unknown as Package).status !== 'PICKED_UP'" size="sm" variant="ghost" @click="doPickup((row as any).id)"><Check class="h-4 w-4 text-emerald-600" /></Button>
          </template>
        </DataTable>
      </Card>
    </div>

    <Modal v-model:open="showPkg" title="Registrar encomenda">
      <div class="space-y-3">
        <div><Label>Apartamento</Label><Select v-model="pkgForm.apartmentId" :options="aptOptions" placeholder="Selecione" /></div>
        <div><Label>Descrição</Label><Input v-model="pkgForm.description" placeholder="Caixa, envelope..." /></div>
        <div><Label>Transportadora</Label><Input v-model="pkgForm.carrier" /></div>
        <div>
          <Label>Foto da encomenda (opcional)</Label>
          <div v-if="pkgPhoto" class="mt-1 flex flex-col items-center gap-2">
            <img :src="pkgPhoto" alt="Foto da encomenda" class="h-48 w-48 rounded-md border object-cover" />
            <Button variant="outline" size="sm" @click="pkgPhoto = null"><X class="h-4 w-4" /> Refazer</Button>
          </div>
          <CameraCapture v-else class="mt-1" @capture="(d) => (pkgPhoto = d)" @error="(m) => toast.error(m)" />
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showPkg = false">Cancelar</Button>
        <Button :disabled="!pkgForm.apartmentId" @click="submitPkg">Registrar</Button>
      </template>
    </Modal>

    <Modal v-model:open="checkInOpen" :title="`Entrada — ${checkInTarget?.fullName ?? ''}`" description="Capture uma foto do visitante (opcional) e registre a entrada.">
      <div class="space-y-3">
        <div v-if="capturedPhoto" class="flex flex-col items-center gap-2">
          <img :src="capturedPhoto" alt="Foto capturada" class="h-48 w-48 rounded-md border object-cover" />
          <Button variant="outline" size="sm" @click="capturedPhoto = null"><X class="h-4 w-4" /> Refazer</Button>
        </div>
        <CameraCapture v-else @capture="(d) => (capturedPhoto = d)" @error="(m) => toast.error(m)" />
      </div>
      <template #footer>
        <Button variant="outline" @click="checkInTarget = null">Cancelar</Button>
        <Button :disabled="visitorAction.isPending.value" @click="confirmCheckIn">
          <LogIn class="h-4 w-4" /> Registrar entrada
        </Button>
      </template>
    </Modal>

    <Modal v-model:open="photoOpen" title="Foto da encomenda">
      <img v-if="photoView" :src="photoView" alt="Foto da encomenda" class="max-h-[70vh] w-full rounded-md border object-contain" />
      <template #footer><Button @click="photoView = null">Fechar</Button></template>
    </Modal>
  </div>
</template>
