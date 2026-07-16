"use client";

import { useState } from "react";
import { Mail, MessageCircle, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function ComposeMessage() {
  const [message, setMessage] = useState("");

  // Email
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // WhatsApp
  const [phone, setPhone] = useState("");
  const [waMsg, setWaMsg] = useState<string | null>(null);

  const sendEmail = async () => {
    setEmailMsg(null);
    if (!message.trim()) return setEmailMsg({ ok: false, text: "Type a message first." });
    if (!to.trim()) return setEmailMsg({ ok: false, text: "Enter a recipient email." });
    setSending(true);
    const res = await fetch("/api/message/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, message }),
    });
    const json = await res.json();
    setSending(false);
    setEmailMsg({ ok: !!json.success, text: json.message ?? (json.success ? "Sent." : "Failed.") });
  };

  const sendWhatsApp = () => {
    setWaMsg(null);
    if (!message.trim()) return setWaMsg("Type a message first.");
    const digits = phone.replace(/[^\d]/g, ""); // country code + number, digits only
    const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
    const url = `${base}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
    setWaMsg(
      digits
        ? "Opening WhatsApp… press Send there to deliver."
        : "Opening WhatsApp — pick a contact, then press Send."
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-fg">Send Message</h1>
        <p className="text-sm text-muted">
          Compose a message and send it by email or WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="msg">Message text</Label>
          <textarea
            id="msg"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here…"
            className="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg shadow-sm transition-colors placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <p className="mt-1 text-xs text-faint">
            The same message text is used for both email and WhatsApp.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" /> Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="name@example.com (comma-separate for several)"
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
              />
            </div>
            {emailMsg && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ring-1 ${
                  emailMsg.ok
                    ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
                    : "bg-red-500/10 text-red-500 ring-red-500/20"
                }`}
              >
                {emailMsg.text}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={sendEmail} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending…" : "Send Email"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="phone">Phone number (with country code)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 91 98765 43210"
                inputMode="tel"
              />
              <p className="mt-1 text-xs text-faint">
                Include the country code (91 for India). Leave blank to pick a contact in WhatsApp.
              </p>
            </div>
            {waMsg && (
              <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500 ring-1 ring-emerald-500/20">
                {waMsg}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={sendWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-600/90"
              >
                <MessageCircle className="h-4 w-4" /> Send via WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
