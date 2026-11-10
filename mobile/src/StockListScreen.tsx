import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchStock, type StockRow } from "./api";
import { Banner, s, t } from "./ui";

const PAGE_SIZE = 20;

const TYPE_TONE: Record<string, string> = {
  RECEIPT: t.success,
  ISSUE: t.warning,
  ADJUSTMENT: t.accent,
};

/** "2026-10-27" → "27 Oct 2026" without pulling in a date library. */
function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * The stock ledger.
 *
 * Search and paging are the server's job here (`GET /api/stock`) — the web
 * page hands a block of rows to DataTable and filters in the browser, which a
 * phone on a slow LAN can't afford.
 */
export default function StockListScreen({
  onAdd,
  onSignOut,
  userName,
}: {
  onAdd: () => void;
  onSignOut: () => void;
  userName: string;
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<StockRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  /** Guards against a second page landing after the search has moved on. */
  const requestId = useRef(0);

  const load = useCallback(async (term: string, nextPage: number) => {
    const id = ++requestId.current;
    const result = await fetchStock(term, nextPage, PAGE_SIZE);
    if (id !== requestId.current) return;

    if (!result.success || !result.data) {
      setError(result.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const data = result.data;
    setError("");
    setRows((prev) => (nextPage === 1 ? data.rows : [...prev, ...data.rows]));
    setTotal(data.total);
    setPage(data.page);
    setHasMore(data.hasMore);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Debounced search — one request per pause, not per keystroke.
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => load(search, 1), 350);
    return () => clearTimeout(timer);
  }, [search, load]);

  const refresh = () => {
    setRefreshing(true);
    load(search, 1);
  };

  return (
    <View style={[s.screen, { padding: 0 }]}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.fg, fontSize: 20, fontWeight: "800" }}>Stock Ledger</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>
              {userName} · {total} {total === 1 ? "entry" : "entries"}
            </Text>
          </View>
          <Pressable onPress={onSignOut} hitSlop={10}>
            <Text style={{ color: t.muted, fontWeight: "600" }}>Sign out</Text>
          </Pressable>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search item, location or remarks…"
          placeholderTextColor={t.faint}
          autoCorrect={false}
          style={s.input}
        />
      </View>

      {error ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Banner tone="error" text={error} />
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.accent} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore && !loading) load(search, page + 1);
          }}
          ListEmptyComponent={
            <Text style={s.empty}>
              {search ? "No entries match that search." : "No stock entries yet."}
            </Text>
          }
          ListFooterComponent={
            hasMore ? <ActivityIndicator color={t.faint} style={{ marginVertical: 16 }} /> : undefined
          }
          renderItem={({ item }) => <Row row={item} />}
        />
      )}

      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [
          {
            position: "absolute",
            right: 20,
            bottom: 28,
            backgroundColor: "#4f46e5",
            borderRadius: 28,
            paddingHorizontal: 20,
            paddingVertical: 15,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>+ New entry</Text>
      </Pressable>
    </View>
  );
}

function Row({ row }: { row: StockRow }) {
  const tone = TYPE_TONE[row.transaction_type] ?? t.muted;
  const qty = row.receipt_qty || row.issue_qty || 0;
  const sign = row.issue_qty ? "−" : "+";

  return (
    <View style={[s.card, { marginBottom: 10 }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: t.fg, fontWeight: "700", fontSize: 15 }}>
            {row.item_name ?? "—"}
          </Text>
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
            {formatDate(row.transaction_date)}
            {row.location ? ` · ${row.location}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: tone, fontWeight: "800", fontSize: 16 }}>
            {sign}
            {qty}
          </Text>
          <Text style={{ color: t.faint, fontSize: 11 }}>bal {row.balance_qty ?? 0}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <Pill text={row.transaction_type} color={tone} />
        {row.item_status ? <Pill text={row.item_status.replace(/_/g, " ")} color={t.muted} /> : null}
        {row.to_name ? <Pill text={`→ ${row.to_name}`} color={t.muted} /> : null}
        {row.from_name ? <Pill text={`← ${row.from_name}`} color={t.muted} /> : null}
      </View>

      {row.remarks ? (
        <Text style={{ color: t.faint, fontSize: 12, marginTop: 8 }}>{row.remarks}</Text>
      ) : null}
    </View>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <Text
      style={{
        color,
        borderColor: `${color}55`,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        fontSize: 11,
        fontWeight: "600",
      }}
    >
      {text}
    </Text>
  );
}
