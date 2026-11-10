import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import {
  createStockEntry,
  fetchStockOptions,
  type StockOptions,
  type NewStockEntry,
} from "./api";
import { Banner, Button, Card, Field, PickerField, SegmentField, Screen, s, t } from "./ui";

const TYPES = [
  { value: "RECEIPT", label: "Receipt" },
  { value: "ISSUE", label: "Issue" },
  { value: "ADJUSTMENT", label: "Adjust" },
];

const STATUSES = [
  { value: "WORKING", label: "Working" },
  { value: "NOT_WORKING", label: "Not working" },
  { value: "CONDEMNED", label: "Condemned" },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * A new stock entry.
 *
 * The same `POST /api/stock` the web form posts to, so the server does all the
 * validating and the ledger recompute — this screen only has to collect the
 * fields and show whatever the server says back.
 */
export default function StockEntryScreen({
  onDone,
  onCancel,
}: {
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [options, setOptions] = useState<StockOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [group, setGroup] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [department, setDepartment] = useState("");
  const [type, setType] = useState("RECEIPT");
  const [date, setDate] = useState(today());
  const [qty, setQty] = useState("");
  const [register, setRegister] = useState("");
  const [pageNo, setPageNo] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [status, setStatus] = useState("WORKING");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    (async () => {
      const result = await fetchStockOptions();
      if (!result.success || !result.data) {
        setLoadError(result.message);
        return;
      }
      setOptions(result.data);
    })();
  }, []);

  // Choosing a group narrows the item list, exactly as the web form does.
  const itemChoices = useMemo(() => {
    const all = options?.stockBooks ?? [];
    const list = group ? all.filter((b) => String(b.group_id) === group) : all;
    return list.map((b) => ({ value: b.key, label: b.name }));
  }, [options, group]);

  /** An "item:" key has no ledger row yet, so it needs a location to open one. */
  const needsLocation = item.startsWith("item:");

  const save = async () => {
    setError("");
    if (!item) return setError("Choose an item.");
    if (needsLocation && !location) return setError("Choose where this item is kept.");
    if (!department) return setError("Choose a department.");
    if (!qty.trim()) return setError("Enter a quantity.");

    const entry: NewStockEntry = {
      stock_book_id: item,
      department_id: department,
      transaction_type: type,
      transaction_date: date.trim(),
      qty: qty.trim(),
      item_status: status,
      remarks: remarks.trim(),
    };
    if (needsLocation) entry.new_location_id = location;
    if (register) entry.stock_book_master_id = register;
    if (pageNo.trim()) entry.stock_book_page_no = pageNo.trim();
    if (type === "ISSUE" && issuedTo) entry.issued_to_location_id = issuedTo;

    setSaving(true);
    const result = await createStockEntry(entry);
    setSaving(false);

    if (!result.success) {
      setError(result.message);
      return;
    }
    onDone(result.message || "Stock entry saved.");
  };

  if (loadError) {
    return (
      <Screen>
        <Banner tone="error" text={loadError} />
        <Button title="Back" variant="soft" onPress={onCancel} />
      </Screen>
    );
  }

  if (!options) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const opts = (list: { id: number; name: string }[]) =>
    list.map((o) => ({ value: String(o.id), label: o.name }));

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <Pressable onPress={onCancel} hitSlop={10}>
              <Text style={{ color: t.muted, fontSize: 16 }}>‹ Back</Text>
            </Pressable>
            <Text style={{ color: t.fg, fontSize: 20, fontWeight: "800", marginLeft: 12 }}>
              New stock entry
            </Text>
          </View>

          <Banner tone="error" text={error} />

          <Card style={{ marginBottom: 14 }}>
            <PickerField
              label="Item group (optional filter)"
              value={group}
              choices={[{ value: "", label: "All groups" }, ...opts(options.groups)]}
              onChange={(v) => {
                setGroup(v);
                setItem("");
              }}
              placeholder="All groups"
            />
            <PickerField
              label="Item"
              value={item}
              choices={itemChoices}
              onChange={setItem}
              placeholder="Choose the article"
            />
            {needsLocation ? (
              <PickerField
                label="Kept at"
                value={location}
                choices={opts(options.locations)}
                onChange={setLocation}
                placeholder="Choose a location"
              />
            ) : null}
            <PickerField
              label="Department"
              value={department}
              choices={opts(options.departments)}
              onChange={setDepartment}
              placeholder="Choose a department"
            />
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <SegmentField label="Entry type" value={type} choices={TYPES} onChange={setType} />
            <Field
              label="Quantity"
              value={qty}
              onChangeText={setQty}
              keyboardType="numbers-and-punctuation"
              placeholder="0"
              hint={type === "ADJUSTMENT" ? "A minus sign draws stock down." : undefined}
            />
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            {type === "ISSUE" ? (
              <PickerField
                label="Issued to"
                value={issuedTo}
                choices={opts(options.locations)}
                onChange={setIssuedTo}
                placeholder="Choose a location"
              />
            ) : null}
            <SegmentField
              label="Item status"
              value={status}
              choices={STATUSES}
              onChange={setStatus}
            />
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <PickerField
              label="Stock register (optional)"
              value={register}
              choices={[{ value: "", label: "Not recorded" }, ...opts(options.registers)]}
              onChange={setRegister}
              placeholder="Not recorded"
            />
            <Field
              label="Page no (optional)"
              value={pageNo}
              onChangeText={setPageNo}
              keyboardType="number-pad"
              placeholder="—"
            />
            <Field
              label="Remarks (optional)"
              value={remarks}
              onChangeText={setRemarks}
              multiline
              placeholder="Anything worth noting"
            />
          </Card>

          <Button title="Save entry" onPress={save} loading={saving} />
          <Button title="Cancel" variant="soft" onPress={onCancel} />
          <Text style={[s.hint, { textAlign: "center", marginTop: 12 }]}>
            Saved entries appear in the ledger on the website straight away.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
