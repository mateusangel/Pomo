import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import type { LabelImage } from '../api/types';
import { Icon } from '../components/Icon';
import { Pomo } from '../components/Pomo';
import { Body, Button, H1 } from '../components/ui';
import { colors, fonts, radius } from '../theme';

const STEPS = ['a tabela nutricional', 'a lista de ingredientes'] as const;

function errorText(e: unknown): string {
  const status = e instanceof ApiError ? e.status : 0;
  if (status === 422) return 'Não consegui ler o rótulo. Tente com mais luz, sem reflexo e com a tabela bem enquadrada.';
  if (status === 429) return 'Muitas tentativas seguidas. Espere um minutinho.';
  if (status === 503) return 'A leitura de rótulos está indisponível no momento.';
  if (status === 502) return 'Não consegui analisar a foto agora. Tente de novo.';
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  return 'Sem conexão com o servidor. Verifique sua internet.';
}

export default function Rotulo() {
  const insets = useSafeAreaInsets();
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [photos, setPhotos] = useState<LabelImage[]>([]);
  const [busy, setBusy] = useState<'shot' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const shoot = async () => {
    if (busy || photos.length >= 2) return;
    setBusy('shot');
    setError(null);
    try {
      const pic = await camera.current?.takePictureAsync({ base64: true, quality: 0.5 });
      if (pic?.base64) setPhotos((p) => [...p, { mimeType: 'image/jpeg', data: pic.base64! }]);
      else setError('Não consegui tirar a foto. Tente de novo.');
    } catch {
      setError('Não consegui tirar a foto. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (busy || photos.length === 0) return;
    setBusy('send');
    setError(null);
    try {
      const analysis = await api.readLabel(photos, barcode);
      router.replace({ pathname: '/produto/[barcode]', params: { barcode: analysis.product.barcode } });
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  };

  if (!permission) return <View style={s.dark} />;

  if (!permission.granted) {
    return (
      <View style={[s.permission, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable accessibilityLabel="Fechar" hitSlop={12} onPress={close} style={s.closeLight}>
          <Icon name="close" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Pomo size={160} mood="neutro" />
          <H1 style={{ textAlign: 'center' }}>Preciso da câmera</H1>
          <Body mute style={{ textAlign: 'center', maxWidth: 300 }}>
            É para ler a tabela nutricional e os ingredientes. A foto é enviada só para a leitura e não fica guardada.
          </Body>
        </View>
        <Button label="Permitir câmera" onPress={requestPermission} />
      </View>
    );
  }

  const next = photos.length < 2 ? STEPS[photos.length] : null;

  return (
    <View style={s.dark}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
      <View style={[s.top, { paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityLabel="Fechar" hitSlop={12} onPress={close} style={s.round}>
          <Icon name="close" color="#fff" />
        </Pressable>
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={s.title}>
          {next ? `Fotografe ${next}` : 'Pronto para analisar'}
        </Text>
        <Text style={s.sub}>
          {photos.length === 0
            ? 'Enquadre bem, com boa luz. Os ingredientes são opcionais.'
            : `${photos.length} de 2 fotos tiradas`}
        </Text>
        {!!error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}

        <View style={s.controls}>
          <Pressable
            accessibilityLabel="Tirar foto"
            disabled={!!busy || photos.length >= 2}
            onPress={shoot}
            style={[s.shutter, (photos.length >= 2 || !!busy) && { opacity: 0.4 }]}
          >
            {busy === 'shot' ? <ActivityIndicator color={colors.ink} /> : <View style={s.shutterInner} />}
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {photos.length > 0 && (
            <Pressable
              accessibilityRole="button"
              disabled={!!busy}
              onPress={() => setPhotos([])}
              style={({ pressed }) => [s.redo, pressed && { opacity: 0.8 }]}
            >
              <Text style={s.redoText}>Refazer</Text>
            </Pressable>
          )}
          <Button
            label={busy === 'send' ? 'Analisando...' : 'Analisar'}
            tone="leaf"
            style={{ flex: 1 }}
            disabled={photos.length === 0 || !!busy}
            onPress={send}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#000' },
  permission: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24 },
  closeLight: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, gap: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  title: { fontFamily: fonts.displayMid, fontSize: 20, color: '#fff' },
  sub: { fontFamily: fonts.body, fontSize: 14, color: '#E5E5EA' },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: '#FDA4AF' },
  controls: { alignItems: 'center', paddingVertical: 4 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  redo: { minHeight: 56, paddingHorizontal: 22, borderRadius: radius.xl, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  redoText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
});
