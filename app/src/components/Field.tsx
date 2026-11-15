import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '../theme';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  /** Mostra o botão "Mostrar/Ocultar" e esconde o texto. */
  password?: boolean;
}

export type FieldHandle = ComponentRef<typeof TextInput>;

export const Field = forwardRef<FieldHandle, FieldProps>(function Field({ label, error, password, style, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.box, focused && s.focused, !!error && s.errorBox]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.mute}
          maxFontSizeMultiplier={1.3}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          {...rest}
          secureTextEntry={password ? hidden : rest.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[s.input, style]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
            hitSlop={10}
            onPress={() => setHidden(!hidden)}
          >
            <Text style={s.toggle}>{hidden ? 'Mostrar' : 'Ocultar'}</Text>
          </Pressable>
        )}
      </View>
      {!!error && (
        <Text style={s.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 16,
    gap: 12,
  },
  focused: { borderColor: colors.ink },
  errorBox: { borderColor: colors.danger },
  input: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  toggle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.leafDeep },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger },
});
