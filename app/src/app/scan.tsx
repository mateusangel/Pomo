import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Pomo } from '../components/Pomo';
import { Body, Button, H1 } from '../components/ui';
import { colors, fonts } from '../theme';

const CORNER = 36;

export default function Scan() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const handled = useRef(false);

  const open = (barcode: string) => {
    if (handled.current) return;
    handled.current = true;
    router.replace({ pathname: '/produto/[barcode]', params: { barcode, fromScan: '1' } });
  };

  if (!permission) return <View style={s.dark} />;

  if (!permission.granted) {
    return (
      <View style={[s.permission, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable accessibilityLabel="Fechar" hitSlop={12} onPress={() => router.back()} style={s.closeLight}>
          <Icon name="close" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Pomo size={160} mood="neutro" />
          <H1 style={{ textAlign: 'center' }}>Preciso da câmera</H1>
          <Body mute style={{ textAlign: 'center', maxWidth: 300 }}>É só para ler o código de barras. Não guardamos nenhuma foto.</Body>
        </View>
        <Button label="Permitir câmera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={s.dark}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={({ data }) => open(data)}
      />
      <View style={[s.top, { paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityLabel="Fechar" hitSlop={12} onPress={() => router.back()} style={s.round}>
          <Icon name="close" color="#fff" />
        </Pressable>
        <Pressable accessibilityLabel={torch ? 'Desligar lanterna' : 'Ligar lanterna'} hitSlop={12} onPress={() => setTorch(!torch)} style={[s.round, torch && { backgroundColor: colors.leaf }]}>
          <Icon name="flash" color={torch ? colors.ink : '#fff'} />
        </Pressable>
      </View>

      <View style={s.center} pointerEvents="none">
        <View style={s.frame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[s.corner, s[c]]} />
          ))}
        </View>
        <Text style={s.hint}>Aponte para o código de barras</Text>
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 20 }]}>
        {manual ? (
          <View style={s.manualRow}>
            <TextInput
              style={s.input}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              placeholder="Digite os números"
              placeholderTextColor={colors.mute}
              keyboardType="number-pad"
              maxLength={14}
              autoFocus
            />
            <Pressable accessibilityRole="button" onPress={() => code.length >= 8 && open(code)} style={[s.go, code.length < 8 && { opacity: 0.4 }]}>
              <Text style={s.goText}>Buscar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setManual(true)} style={s.manualBtn}>
            <Text style={s.manualText}>Digitar o código</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dark: { flex: 1, backgroundColor: colors.ink },
  permission: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24 },
  closeLight: { alignSelf: 'flex-start' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(11,11,15,0.55)', alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 24 },
  frame: { width: 280, height: 190 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.leaf },
  tl: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 },
  hint: { fontFamily: fonts.bodyMedium, fontSize: 15, color: '#fff', backgroundColor: 'rgba(11,11,15,0.55)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  manualBtn: { height: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center' },
  manualText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  manualRow: { flexDirection: 'row', gap: 10, width: '100%' },
  input: { flex: 1, height: 52, borderRadius: 26, backgroundColor: '#fff', paddingHorizontal: 20, fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.ink },
  go: { height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: colors.leaf, justifyContent: 'center' },
  goText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
