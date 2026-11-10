import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { currentUser, logout, restore, type SessionUser } from "./src/api";
import LoginScreen from "./src/LoginScreen";
import StockListScreen from "./src/StockListScreen";
import StockEntryScreen from "./src/StockEntryScreen";
import { Banner, t } from "./src/ui";

/**
 * GPCN Stock — the phone client for the college stock system.
 *
 * Four screens and one decision (signed in or not), so navigation is a piece
 * of state rather than a router: a library would be more moving parts than the
 * app has screens.
 */
type Screen = "list" | "entry";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [screen, setScreen] = useState<Screen>("list");
  const [flash, setFlash] = useState("");
  /** Bumped after a save so the list refetches instead of showing stale rows. */
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    (async () => {
      await restore();
      setUser(await currentUser());
      setBooting(false);
    })();
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setScreen("list");
  }, []);

  // A saved entry announces itself on the list for a few seconds — the phone's
  // version of the web app's toast.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(""), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.surface }}>
      <StatusBar style="light" />
      {booting ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 60 }} />
      ) : !user ? (
        <LoginScreen onSignedIn={setUser} />
      ) : screen === "entry" ? (
        <StockEntryScreen
          onCancel={() => setScreen("list")}
          onDone={(message) => {
            setFlash(message);
            setListKey((k) => k + 1);
            setScreen("list");
          }}
        />
      ) : (
        <>
          {flash ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Banner tone="success" text={flash} />
            </View>
          ) : null}
          <StockListScreen
            key={listKey}
            userName={user.fullName || user.username}
            onAdd={() => setScreen("entry")}
            onSignOut={signOut}
          />
        </>
      )}
    </SafeAreaView>
  );
}
