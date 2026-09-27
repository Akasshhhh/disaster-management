"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Crosshair,
  Flame,
  HeartPulse,
  MapPin,
  Radio,
  ShieldCheck,
  Siren,
  Truck,
  UsersRound,
  Waves,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Disaster = {
  id: string;
  title: string;
  description: string;
  location: { name: string; latitude: number; longitude: number };
  tags: string[];
  status: "active" | "contained" | "resolved" | string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Resource = {
  id: string;
  name: string;
  type: string;
  distanceKm: number;
};

type Report = { content: string; user: string; created_at: string };
type User = { email: string; role: "ADMIN" | "CONTRIBUTOR" };
type RealtimeEvent = {
  id: string;
  action: "created" | "updated";
  title: string;
  location: string;
  receivedAt: string;
};
type SocketStatus = "connecting" | "connected" | "disconnected";
type FormMode = "create" | "edit" | null;

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Time unavailable"
    : dateFormatter.format(date);
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "destructive"
      : status === "contained"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

function ResourceGlyph({ type }: { type: string }) {
  switch (type) {
    case "hospital":
      return <HeartPulse aria-hidden="true" />;
    case "rescue":
      return <Truck aria-hidden="true" />;
    case "food":
      return <UsersRound aria-hidden="true" />;
    case "water":
      return <Waves aria-hidden="true" />;
    default:
      return <ShieldCheck aria-hidden="true" />;
  }
}

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("Admin123!");
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const [detailResult, setDetailResult] = useState<{
    id: string;
    resources: Resource[];
    reports: Report[];
    error: string;
  } | null>(null);
  const [loadingDisasters, setLoadingDisasters] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [formStatus, setFormStatus] = useState("active");

  const selected = useMemo(
    () => disasters.find((item) => item.id === selectedId),
    [disasters, selectedId],
  );
  const selectedDetails =
    selected && detailResult?.id === selected.id ? detailResult : null;
  const loadingDetails = Boolean(selected && !selectedDetails);
  const detailError = selectedDetails?.error ?? "";
  const resources = selectedDetails?.resources ?? [];
  const reports = selectedDetails?.reports ?? [];

  const filteredDisasters = useMemo(() => {
    const query = search.trim().toLowerCase();
    return disasters.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const searchable = [
        item.title,
        item.location.name,
        item.description,
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [disasters, search, statusFilter]);

  const api = useCallback(
    async function apiRequest<T>(
      path: string,
      init: RequestInit = {},
    ): Promise<T> {
      const response = await fetch(path, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
      const body = response.status === 204 ? undefined : await response.json();
      if (!response.ok)
        throw new Error(body?.error?.message ?? "Request failed");
      return body as T;
    },
    [token],
  );

  const loadDisasters = useCallback(async () => {
    setLoadingDisasters(true);
    try {
      const response = await fetch("/api/disasters", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok)
        throw new Error("Could not load incidents. Please try again.");
      const result = (await response.json()) as { items: Disaster[] };
      setDisasters(result.items);
      setSelectedId((current) =>
        result.items.some((item) => item.id === current)
          ? current
          : (result.items[0]?.id ?? ""),
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load incidents.",
      );
    } finally {
      setLoadingDisasters(false);
    }
  }, [token]);

  useEffect(() => {
    let current = true;
    void fetch("/api/disasters", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Could not load incidents. Please try again.");
        return (await response.json()) as { items: Disaster[] };
      })
      .then((result) => {
        if (!current) return;
        setDisasters(result.items);
        setSelectedId((selected) =>
          result.items.some((item) => item.id === selected)
            ? selected
            : (result.items[0]?.id ?? ""),
        );
        setError("");
      })
      .catch((cause: unknown) => {
        if (current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load incidents.",
          );
      })
      .finally(() => {
        if (current) setLoadingDisasters(false);
      });
    return () => {
      current = false;
    };
  }, [token]);

  useEffect(() => {
    const socket: Socket = io({ path: "/socket.io" });
    const onCreated = (item: Disaster) => addRealtimeEvent(item, "created");
    const onUpdated = (item: Disaster) => addRealtimeEvent(item, "updated");
    function addRealtimeEvent(item: Disaster, action: RealtimeEvent["action"]) {
      setEvents((current) =>
        [
          {
            id: `${item.id}-${Date.now()}`,
            action,
            title: item.title,
            location: item.location.name,
            receivedAt: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 8),
      );
      void loadDisasters();
    }

    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("connect_error", () => setSocketStatus("disconnected"));
    socket.on("disaster_created", onCreated);
    socket.on("disaster_updated", onUpdated);
    return () => {
      socket.off("disaster_created", onCreated);
      socket.off("disaster_updated", onUpdated);
      socket.disconnect();
    };
  }, [loadDisasters]);

  useEffect(() => {
    if (!selected) return;
    let current = true;
    void Promise.all([
      api<{ resources: Resource[] }>(
        `/api/disasters/${selected.id}/resources?lat=${selected.location.latitude}&lng=${selected.location.longitude}&radius=25`,
      ),
      api<{ reports: Report[] }>(`/api/disasters/${selected.id}/reports`),
    ])
      .then(([resourceResult, reportResult]) => {
        if (!current) return;
        setDetailResult({
          id: selected.id,
          resources: resourceResult.resources,
          reports: reportResult.reports,
          error: "",
        });
      })
      .catch((cause: unknown) => {
        if (current) {
          setDetailResult({
            id: selected.id,
            resources: [],
            reports: [],
            error:
              cause instanceof Error
                ? cause.message
                : "Could not load incident details.",
          });
        }
      });
    return () => {
      current = false;
    };
  }, [api, selected]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api<{ token: string; user: User }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );
      setToken(result.token);
      setUser(result.user);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setTitle("");
    setDescription("");
    setTags("");
    setFormStatus("active");
    setFormMode("create");
    setError("");
  }

  function startEdit() {
    if (!selected) return;
    setTitle(selected.title);
    setDescription(selected.description);
    setTags(selected.tags.join(", "));
    setFormStatus(selected.status);
    setFormMode("edit");
    setError("");
  }

  async function saveDisaster(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || (formMode === "edit" && !selected)) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: formStatus,
    };
    try {
      const saved =
        formMode === "edit"
          ? await api<Disaster>(`/api/disasters/${selected?.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            })
          : await api<Disaster>("/api/disasters", {
              method: "POST",
              body: JSON.stringify(payload),
            });
      setDisasters((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setFormMode(null);
      setError("");
      await loadDisasters();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the incident.",
      );
    } finally {
      setSaving(false);
    }
  }

  const activeCount = disasters.filter(
    (item) => item.status === "active",
  ).length;
  const containedCount = disasters.filter(
    (item) => item.status === "contained",
  ).length;
  const socketLabel =
    socketStatus === "connected"
      ? "Live updates connected"
      : socketStatus === "connecting"
        ? "Connecting to live updates"
        : "Live updates unavailable";

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="border-b border-border/70 bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Siren aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Response desk
              </p>
              <p className="text-xs text-muted-foreground">
                Disaster coordination
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              <span
                className={`status-dot ${socketStatus === "connected" ? "status-dot-live" : ""}`}
              />
              <span className="hidden sm:inline">{socketLabel}</span>
              <span className="sm:hidden">
                {socketStatus === "connected" ? "Live" : "Offline"}
              </span>
            </div>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden text-right sm:block">
                  <p className="max-w-48 truncate text-sm font-medium">
                    {user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.role === "ADMIN" ? "Administrator" : "Contributor"}
                  </p>
                </div>
                <Badge variant="secondary">Signed in</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setToken("");
                    setUser(null);
                  }}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <>
                <Badge variant="outline">Guest access</Badge>
                <a className={buttonVariants({ size: "sm" })} href="#access">
                  Sign in
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 py-8 sm:px-6 lg:gap-8 lg:py-10">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Activity aria-hidden="true" className="size-4" /> Field
              operations
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Incident coordination
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
              A clear view of active response, nearby support, and community
              updates.
            </p>
          </div>
          <Button
            onClick={startCreate}
            disabled={!user}
            className="sm:self-end"
          >
            <AlertTriangle data-icon="inline-start" />
            Report an incident
          </Button>
        </section>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Action needed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section
          aria-label="Response overview"
          className="grid gap-4 sm:grid-cols-3"
        >
          <MetricCard
            label="Tracked incidents"
            value={disasters.length}
            icon={<Crosshair aria-hidden="true" />}
            note="Across all response areas"
          />
          <MetricCard
            label="Active response"
            value={activeCount}
            icon={<Flame aria-hidden="true" />}
            note="Requiring current coordination"
            highlight
          />
          <MetricCard
            label="Contained"
            value={containedCount}
            icon={<ShieldCheck aria-hidden="true" />}
            note="Under control, still monitored"
          />
        </section>

        {formMode && (
          <Card id="incident-form" className="scroll-mt-6">
            <CardHeader className="border-b">
              <CardTitle>
                {formMode === "edit" ? "Update incident" : "Report an incident"}
              </CardTitle>
              <CardDescription>
                Add a clear description and a recognizable place so responders
                can coordinate accurately.
              </CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormMode(null)}
                >
                  Cancel
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={saveDisaster}>
                <FieldGroup className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="incident-title">
                      Incident title
                    </FieldLabel>
                    <Input
                      id="incident-title"
                      required
                      minLength={3}
                      maxLength={160}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Manhattan flash flooding"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="incident-tags">Tags</FieldLabel>
                    <Input
                      id="incident-tags"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="flood, storm"
                    />
                    <FieldDescription>
                      Separate tags with commas.
                    </FieldDescription>
                  </Field>
                  <Field className="md:col-span-2">
                    <FieldLabel htmlFor="incident-description">
                      Situation and location
                    </FieldLabel>
                    <Textarea
                      id="incident-description"
                      required
                      minLength={10}
                      maxLength={5000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Flooding reported around Manhattan, NYC after intense rainfall."
                      className="min-h-28"
                    />
                    <FieldDescription>
                      Include a known city, neighborhood, or landmark.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="incident-status">
                      Response status
                    </FieldLabel>
                    <Select
                      value={formStatus}
                      onValueChange={(value) => {
                        if (value) setFormStatus(value);
                      }}
                    >
                      <SelectTrigger id="incident-status" className="w-full">
                        <SelectValue placeholder="Choose a status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="contained">Contained</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="flex items-end justify-start gap-2 md:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormMode(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Spinner data-icon="inline-start" />}
                      {formMode === "edit" ? "Save changes" : "Create incident"}
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        )}

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Incident register</CardTitle>
              <CardDescription>
                {disasters.length} tracked{" "}
                {disasters.length === 1 ? "incident" : "incidents"}
              </CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadDisasters()}
                  disabled={loadingDisasters}
                >
                  {loadingDisasters ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Activity data-icon="inline-start" />
                  )}
                  Refresh
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_132px]">
                <div className="grid gap-2">
                  <Label htmlFor="incident-search">Find an incident</Label>
                  <Input
                    id="incident-search"
                    type="search"
                    placeholder="Search location, title, or tag"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      if (value) setStatusFilter(value);
                    }}
                  >
                    <SelectTrigger id="status-filter" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="contained">Contained</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              {loadingDisasters && disasters.length === 0 ? (
                <div
                  className="flex flex-col gap-3"
                  aria-label="Loading incidents"
                >
                  {[0, 1, 2].map((item) => (
                    <Skeleton key={item} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredDisasters.length ? (
                <div
                  className="flex flex-col gap-2"
                  aria-label="Disaster incidents"
                >
                  {filteredDisasters.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setFormMode(null);
                      }}
                      aria-pressed={item.id === selectedId}
                      className={`incident-row ${item.id === selectedId ? "incident-row-selected" : ""}`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-2 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">
                            {item.title}
                          </span>
                          <StatusBadge status={item.status} />
                        </span>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                          />
                          <span className="truncate">{item.location.name}</span>
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 aria-hidden="true" className="size-3.5" />{" "}
                          Updated {formatDate(item.updated_at)}
                        </span>
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <Empty className="min-h-52 border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Crosshair aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>
                      {disasters.length
                        ? "No matching incidents"
                        : "No incidents yet"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {disasters.length
                        ? "Try a different search or status."
                        : "Newly reported incidents will appear here."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              {!user && (
                <p className="text-xs text-muted-foreground">
                  Sign in to report or update an incident.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            <Card>
              {selected ? (
                <>
                  <CardHeader className="border-b">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Incident detail</Badge>
                      <StatusBadge status={selected.status} />
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {selected.title}
                    </h2>
                    <CardDescription className="flex items-center gap-1.5">
                      <MapPin aria-hidden="true" className="size-4 shrink-0" />{" "}
                      {selected.location.name}
                    </CardDescription>
                    <CardAction>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startEdit}
                        disabled={!user}
                      >
                        Edit incident
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5 pt-5">
                    <div className="flex flex-wrap gap-2">
                      {selected.tags.length ? (
                        selected.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No tags assigned
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                      {selected.description}
                    </p>
                    <div className="grid gap-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>
                        <span className="font-medium text-foreground">
                          Reported
                        </span>
                        <br />
                        {formatDate(selected.created_at)}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          Last updated
                        </span>
                        <br />
                        {formatDate(selected.updated_at)}
                      </p>
                      <p className="sm:col-span-2">
                        <span className="font-medium text-foreground">
                          Coordinates
                        </span>
                        <br />
                        {selected.location.latitude.toFixed(4)},{" "}
                        {selected.location.longitude.toFixed(4)}
                      </p>
                    </div>
                  </CardContent>
                </>
              ) : (
                <Empty className="min-h-80">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Crosshair aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>Select an incident</EmptyTitle>
                    <EmptyDescription>
                      Choose an entry from the register to see response details.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </Card>

            {selected && (
              <div className="grid gap-5 xl:grid-cols-2">
                <Card>
                  <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                      <Crosshair
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />{" "}
                      Nearby resources
                    </CardTitle>
                    <CardDescription>
                      Within 25 km of this incident
                    </CardDescription>
                    <CardAction>
                      <Badge variant="secondary">{resources.length}</Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {detailError ? (
                      <p className="py-4 text-sm text-destructive" role="alert">
                        {detailError}
                      </p>
                    ) : loadingDetails ? (
                      <div
                        className="flex flex-col gap-3 py-3"
                        aria-label="Loading nearby resources"
                      >
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : resources.length ? (
                      <ul className="divide-y divide-border">
                        {resources.map((resource) => (
                          <li
                            key={resource.id}
                            className="flex items-center justify-between gap-3 py-3 first:pt-2 last:pb-2"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <ResourceGlyph type={resource.type} />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {resource.name}
                                </span>
                                <span className="text-xs capitalize text-muted-foreground">
                                  {resource.type}
                                </span>
                              </span>
                            </span>
                            <Badge variant="outline" className="shrink-0">
                              {resource.distanceKm.toFixed(1)} km
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty className="min-h-36">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Crosshair aria-hidden="true" />
                          </EmptyMedia>
                          <EmptyTitle>No nearby resources</EmptyTitle>
                          <EmptyDescription>
                            No resources were found within this search radius.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                      <UsersRound
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />{" "}
                      Community reports
                    </CardTitle>
                    <CardDescription>
                      Recent updates from the community
                    </CardDescription>
                    <CardAction>
                      <Badge variant="secondary">{reports.length}</Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {detailError ? (
                      <p className="py-4 text-sm text-destructive" role="alert">
                        {detailError}
                      </p>
                    ) : loadingDetails ? (
                      <div
                        className="flex flex-col gap-3 py-3"
                        aria-label="Loading community reports"
                      >
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : reports.length ? (
                      <ul className="divide-y divide-border">
                        {reports.map((report, index) => (
                          <li
                            key={`${report.created_at}-${index}`}
                            className="flex flex-col gap-1.5 py-3 first:pt-2 last:pb-2"
                          >
                            <p className="text-sm leading-5">
                              {report.content}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {report.user} · {formatDate(report.created_at)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty className="min-h-36">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <UsersRound aria-hidden="true" />
                          </EmptyMedia>
                          <EmptyTitle>No community reports</EmptyTitle>
                          <EmptyDescription>
                            Reports will appear here when available.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card id="access" className="scroll-mt-6">
            {user ? (
              <>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />{" "}
                    Access & permissions
                  </CardTitle>
                  <CardDescription>
                    Signed in for incident coordination
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-4">
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {user.role === "ADMIN"
                        ? "Administrator · can manage all incidents"
                        : "Contributor · can create and update owned incidents"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setToken("");
                      setUser(null);
                    }}
                  >
                    Sign out
                  </Button>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />{" "}
                    Coordinator sign in
                  </CardTitle>
                  <CardDescription>
                    Sign in to report or update incidents.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={login}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="login-email">
                          Email address
                        </FieldLabel>
                        <Input
                          id="login-email"
                          type="email"
                          autoComplete="username"
                          required
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="login-password">
                          Password
                        </FieldLabel>
                        <Input
                          id="login-password"
                          type="password"
                          autoComplete="current-password"
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                      </Field>
                      <div className="flex items-center justify-between gap-3 sm:col-span-2">
                        <p className="text-xs text-muted-foreground">
                          Demo: admin@example.com · Admin123!
                        </p>
                        <Button type="submit" disabled={saving}>
                          {saving && <Spinner data-icon="inline-start" />}
                          Sign in
                        </Button>
                      </div>
                    </FieldGroup>
                  </form>
                </CardContent>
              </>
            )}
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Radio
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />{" "}
                Live activity
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span
                  className={`status-dot ${socketStatus === "connected" ? "status-dot-live" : ""}`}
                />
                {socketLabel}
              </CardDescription>
              <CardAction>
                <Badge
                  variant={
                    socketStatus === "connected" ? "secondary" : "outline"
                  }
                >
                  {events.length} events
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-3">
              {events.length ? (
                <ul className="flex flex-col">
                  {events.map((event, index) => (
                    <li
                      key={event.id}
                      className="flex gap-3 py-2.5 first:pt-1 last:pb-1"
                    >
                      <span className="relative flex w-4 justify-center">
                        <span
                          className={`mt-1.5 size-2 rounded-full ${index === 0 ? "bg-primary" : "bg-muted-foreground/40"}`}
                        />
                        {index < events.length - 1 && (
                          <span className="absolute top-4 bottom-0 w-px bg-border" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">
                          <span className="font-medium">
                            Incident {event.action}
                          </span>{" "}
                          · {event.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {event.location} · {formatDate(event.receivedAt)}
                        </span>
                      </span>
                      {event.action === "created" ? (
                        <ArrowUpRight
                          aria-label="Created"
                          className="mt-1 size-4 text-muted-foreground"
                        />
                      ) : (
                        <ArrowDownRight
                          aria-label="Updated"
                          className="mt-1 size-4 text-muted-foreground"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty className="min-h-32">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Radio aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>Waiting for updates</EmptyTitle>
                    <EmptyDescription>
                      Incident changes from connected clients will appear here.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
          <span>
            Response desk · Incident information is shared across connected
            coordinators.
          </span>
          <span>Updates are provided in real time when connected.</span>
        </footer>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
  note,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  note: string;
  highlight?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
        <span
          className={`flex size-10 items-center justify-center rounded-lg ${highlight ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
        >
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}
