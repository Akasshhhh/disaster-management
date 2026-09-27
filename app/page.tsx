"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Disaster = {
  id: string;
  title: string;
  description: string;
  location: { name: string; latitude: number; longitude: number };
  tags: string[];
  status: string;
  createdBy: string;
};

type Resource = { id: string; name: string; type: string; distanceKm: number };
type Report = { content: string; user: string; created_at: string };

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("Admin123!");
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const selected = useMemo(
    () => disasters.find((item) => item.id === selectedId),
    [disasters, selectedId],
  );

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const body = response.status === 204 ? undefined : await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? "Request failed");
    return body as T;
  }

  const loadDisasters = useCallback(async () => {
    try {
      const response = await fetch("/api/disasters", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Could not load disasters");
      const result = (await response.json()) as { items: Disaster[] };
      setDisasters(result.items);
      setSelectedId((current) => current || result.items[0]?.id || "");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load disasters",
      );
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    void fetch("/api/disasters", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load disasters");
        return (await response.json()) as { items: Disaster[] };
      })
      .then((result) => {
        if (!active) return;
        setDisasters(result.items);
        setSelectedId((current) => current || result.items[0]?.id || "");
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load disasters",
          );
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const socket: Socket = io({ path: "/socket.io" });
    const onDisaster = (item: Disaster) => {
      setEvents((current) =>
        [`${item.title} (${item.location.name})`, ...current].slice(0, 6),
      );
      void loadDisasters();
    };
    socket.on("disaster_created", onDisaster);
    socket.on("disaster_updated", onDisaster);
    return () => {
      socket.off("disaster_created", onDisaster);
      socket.off("disaster_updated", onDisaster);
      socket.disconnect();
    };
  }, [loadDisasters]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(result.token);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed");
    }
  }

  async function createDisaster(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await api<Disaster>("/api/disasters", {
        method: "POST",
        body: JSON.stringify({ title, description, tags: ["demo"] }),
      });
      setTitle("");
      setDescription("");
      setSelectedId(created.id);
      await loadDisasters();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Create failed");
    }
  }

  async function loadDetails() {
    if (!selected) return;
    try {
      const [resourceResult, reportResult] = await Promise.all([
        api<{ resources: Resource[] }>(
          `/api/disasters/${selected.id}/resources?lat=${selected.location.latitude}&lng=${selected.location.longitude}&radius=25`,
        ),
        api<{ reports: Report[] }>(`/api/disasters/${selected.id}/reports`),
      ]);
      setResources(resourceResult.resources);
      setReports(reportResult.reports);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load details",
      );
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>Disaster Response</h1>
          <p className="muted">Coordination dashboard · API-backed demo</p>
        </div>
        <span className="muted">Realtime: Socket.IO</span>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="grid">
        <div className="panel">
          <h2>Demo login</h2>
          <p className="muted">
            Admin: admin@example.com · Contributor: volunteer@example.com
          </p>
          <form onSubmit={login}>
            <label className="field">
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="button">
              {token ? "Switch user" : "Log in"}
            </button>
            {token && (
              <button
                className="button secondary"
                type="button"
                onClick={() => setToken("")}
              >
                Log out
              </button>
            )}
          </form>
        </div>
        <div className="panel">
          <h2>Create disaster</h2>
          <form onSubmit={createDisaster}>
            <label className="field">
              Title
              <input
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="field">
              Description with a known place
              <textarea
                required
                minLength={10}
                placeholder="Flooding reported around Manhattan, NYC"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <button className="button" disabled={!token}>
              Create (requires login)
            </button>
          </form>
        </div>
      </section>
      <section className="grid">
        <div className="panel">
          <h2>Disasters</h2>
          <button
            className="button secondary"
            onClick={() => void loadDisasters()}
          >
            Refresh
          </button>
          {disasters.map((item) => (
            <article
              key={item.id}
              className="panel"
              onClick={() => setSelectedId(item.id)}
              style={{
                cursor: "pointer",
                borderColor: item.id === selectedId ? "#165d91" : undefined,
              }}
            >
              <strong>{item.title}</strong>
              <p>
                {item.location.name} · {item.status}
              </p>
              <p className="muted">{item.description}</p>
            </article>
          ))}
        </div>
        <div className="panel">
          <h2>Selected response</h2>
          {selected ? (
            <>
              <p>
                <strong>{selected.location.name}</strong> (
                {selected.location.latitude.toFixed(4)},{" "}
                {selected.location.longitude.toFixed(4)})
              </p>
              <button className="button" onClick={() => void loadDetails()}>
                Load resources and reports
              </button>
              <h3>Nearby resources</h3>
              {resources.map((resource) => (
                <p key={resource.id}>
                  {resource.type}: {resource.name} ·{" "}
                  {resource.distanceKm.toFixed(1)} km
                </p>
              ))}
              <h3>Community reports</h3>
              {reports.map((report, index) => (
                <p key={`${report.created_at}-${index}`}>
                  {report.content}{" "}
                  <span className="muted">— {report.user}</span>
                </p>
              ))}
            </>
          ) : (
            <p className="muted">Select a disaster.</p>
          )}
        </div>
      </section>
      <section className="panel">
        <h2>Realtime events</h2>
        {events.length ? (
          events.map((event, index) => (
            <div className="event" key={`${event}-${index}`}>
              {event}
            </div>
          ))
        ) : (
          <p className="muted">
            Create or update a disaster in another client to see events.
          </p>
        )}
      </section>
    </main>
  );
}
