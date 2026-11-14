import { StyleSheet, View } from 'react-native';
import { Pomo, type PomoMood } from './Pomo';
import { Body, Button } from './ui';

/** Bloco central com mascote, mensagem e ação opcional (carregando, erro, vazio). */
export function StateView({
  mood = 'neutro',
  text,
  action,
  onAction,
}: {
  mood?: PomoMood;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.box}>
      <Pomo size={120} mood={mood} />
      <Body mute style={s.text}>{text}</Body>
      {action && onAction && <Button label={action} onPress={onAction} style={{ alignSelf: 'stretch' }} />}
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', gap: 14, paddingTop: 48, paddingHorizontal: 12 },
  text: { textAlign: 'center', maxWidth: 300 },
});
