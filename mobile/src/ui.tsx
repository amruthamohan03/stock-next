import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

/**
 * The phone's copy of the web app's dark tokens (`globals.css`), so the two
 * read as one system. Same names, same values.
 */
export const t = {
  surface: "#0a0e17",
  card: "#111725",
  elevated: "#1a2234",
  line: "#232d40",
  fg: "#e6e9ef",
  muted: "#99a3b5",
  faint: "#616d82",
  accent: "#818cf8",
  accentSoft: "rgba(129, 140, 248, 0.15)",
  danger: "#f43f5e",
  success: "#22c55e",
  warning: "#f59e0b",
};

export function Screen({ children }: { children: ReactNode }) {
  return <View style={s.screen}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={t.faint}
        {...props}
        style={[s.input, props.multiline && s.inputMultiline, props.style]}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "soft" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        variant === "primary" && s.btnPrimary,
        variant === "soft" && s.btnSoft,
        variant === "danger" && s.btnDanger,
        (pressed || off) && { opacity: off ? 0.55 : 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "soft" ? t.fg : "#fff"} size="small" />
      ) : (
        <Text style={[s.btnText, variant === "soft" && { color: t.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** A tone-coded line of feedback — the phone's stand-in for the web toast. */
export function Banner({ tone, text }: { tone: "error" | "success" | "info"; text: string }) {
  if (!text) return null;
  const color = tone === "error" ? t.danger : tone === "success" ? t.success : t.accent;
  return (
    <View style={[s.banner, { borderColor: color, backgroundColor: `${color}22` }]}>
      <Text style={[s.bannerText, { color }]}>{text}</Text>
    </View>
  );
}

export type Choice = { value: string; label: string };

/**
 * A searchable picker — the web app's `SearchableSelect`, as a full-screen
 * sheet. Every dropdown goes through this: the item list runs to a couple of
 * hundred rows and is unusable as a plain wheel.
 */
export function PickerField({
  label,
  value,
  choices,
  onChange,
  placeholder = "Tap to choose",
  disabled,
}: {
  label: string;
  value: string;
  choices: Choice[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = choices.find((c) => c.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices;
    return choices.filter((c) => c.label.toLowerCase().includes(q));
  }, [choices, query]);

  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[s.input, s.pickerTrigger, disabled && { opacity: 0.55 }]}
      >
        <Text style={{ color: selected ? t.fg : t.faint }} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={{ color: t.faint }}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[s.screen, { paddingTop: 48 }]}>
          <Text style={s.sheetTitle}>{label}</Text>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            placeholderTextColor={t.faint}
            style={s.input}
          />
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.value}
            keyboardShouldPersistTaps="handled"
            style={{ marginTop: 8 }}
            ListEmptyComponent={<Text style={s.empty}>No matches.</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setQuery("");
                  setOpen(false);
                }}
                style={[s.option, item.value === value && { backgroundColor: t.accentSoft }]}
              >
                <Text style={{ color: item.value === value ? t.accent : t.fg }}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
          <Button title="Cancel" variant="soft" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}

/** A row of mutually exclusive choices — for short lists like the entry type. */
export function SegmentField({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: Choice[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <View style={s.segment}>
        {choices.map((c) => (
          <Pressable
            key={c.value}
            onPress={() => onChange(c.value)}
            style={[s.segmentItem, c.value === value && s.segmentItemOn]}
          >
            <Text style={{ color: c.value === value ? "#fff" : t.muted, fontWeight: "600" }}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.surface, padding: 16 },
  card: {
    backgroundColor: t.card,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  field: { marginBottom: 12 },
  label: { color: t.fg, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  hint: { color: t.faint, fontSize: 11, marginTop: 4 },
  input: {
    backgroundColor: t.elevated,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: t.fg,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: "top" },
  pickerTrigger: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  btnPrimary: { backgroundColor: "#4f46e5" },
  btnSoft: { backgroundColor: t.elevated, borderWidth: 1, borderColor: t.line },
  btnDanger: { backgroundColor: "#be123c" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  banner: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  bannerText: { fontSize: 13, fontWeight: "600" },
  sheetTitle: { color: t.fg, fontSize: 18, fontWeight: "700", marginBottom: 10 },
  option: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  empty: { color: t.faint, textAlign: "center", paddingVertical: 24 },
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: t.elevated,
    borderWidth: 1,
    borderColor: t.line,
  },
  segmentItemOn: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
});
