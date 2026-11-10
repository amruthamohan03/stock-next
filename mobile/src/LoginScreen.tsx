import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { getServerUrl, login, setServerUrl, type SessionUser } from "./api";
import { Banner, Button, Card, Field, Screen, s, t } from "./ui";

/**
 * Sign in, and say which server to sign in to.
 *
 * The server address is on this screen on purpose: it is a PC on the college
 * Wi-Fi, so its IP changes, and "which machine am I talking to" is the first
 * thing to check when nothing loads.
 */
export default function LoginScreen({ onSignedIn }: { onSignedIn: (u: SessionUser) => void }) {
  const [server, setServer] = useState(getServerUrl());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setBusy(true);
    setError("");
    await setServerUrl(server);
    const result = await login(username.trim(), password);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    if (result.data?.user) onSignedIn(result.data.user);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Text style={{ color: t.fg, fontSize: 24, fontWeight: "800" }}>GPCN Stock</Text>
            <Text style={{ color: t.muted, marginTop: 4 }}>Stock &amp; Inventory</Text>
          </View>

          <Card>
            <Banner tone="error" text={error} />
            <Field
              label="Server"
              value={server}
              onChangeText={setServer}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.0.138:3001"
              hint="The PC running the stock server, on the same Wi-Fi."
            />
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="supadmin"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <Button title="Sign in" onPress={submit} loading={busy} />
          </Card>

          <Text style={[s.hint, { textAlign: "center", marginTop: 16 }]}>
            Your login is the same one you use on the website.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
