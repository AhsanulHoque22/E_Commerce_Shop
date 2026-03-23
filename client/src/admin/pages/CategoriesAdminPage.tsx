import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/services/api";

type Cat = {
  publicId: string;
  slug: string;
  name: string;
  nameBn: string | null;
  children: Cat[];
};

type CategoryAttrDef = {
  key: string;
  name: string;
  type: "text" | "number" | "boolean" | "select";
  required: boolean;
  options?: string[];
};

type CategoryDetailRes = {
  publicId: string;
  slug: string;
  name: string;
  nameBn: string | null;
  attributeDefinitions: CategoryAttrDef[];
};

type AttrRow = {
  key: string;
  name: string;
  type: "text" | "number" | "boolean" | "select";
  required: boolean;
  optionsText: string;
};

function flattenForParentOptions(nodes: Cat[], prefix = ""): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const c of nodes) {
    const label = prefix ? `${prefix} › ${c.name}` : c.name;
    out.push({ id: c.publicId, label });
    if (c.children.length > 0) {
      out.push(...flattenForParentOptions(c.children, label));
    }
  }
  return out;
}

function CategoryTreeRows(props: {
  nodes: Cat[];
  depth: number;
  onDelete: (publicId: string) => void;
  onEditAttributes: (publicId: string) => void;
}) {
  return (
    <ul className={props.depth ? "mt-2 space-y-2 border-l-2 border-border pl-4" : "space-y-4"}>
      {props.nodes.map((c) => (
        <li
          key={c.publicId}
          className={
            props.depth === 0
              ? "rounded-2xl border border-border bg-surface p-4"
              : "flex flex-col gap-2"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 font-mono text-xs text-muted">{c.slug}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="text-sm text-accent hover:underline"
                onClick={() => props.onEditAttributes(c.publicId)}
              >
                Attributes
              </button>
              <button
                type="button"
                className="text-sm text-red-600 hover:underline"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this category? It must have no products or subcategories."
                    )
                  ) {
                    props.onDelete(c.publicId);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
          {c.children.length > 0 ? (
            <CategoryTreeRows
              nodes={c.children}
              depth={props.depth + 1}
              onDelete={props.onDelete}
              onEditAttributes={props.onEditAttributes}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function defsToRows(defs: CategoryAttrDef[]): AttrRow[] {
  return defs.map((d) => ({
    key: d.key,
    name: d.name,
    type: d.type,
    required: d.required,
    optionsText: d.options?.length ? d.options.join(", ") : "",
  }));
}

function normalizeAttrKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function rowsToSchema(rows: AttrRow[]): CategoryAttrDef[] {
  return rows
    .map((r) => ({
      ...r,
      key: normalizeAttrKey(r.key),
    }))
    .filter((r) => r.key.length > 0 && r.name.trim())
    .map((r) => {
      const opts = r.optionsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const base: CategoryAttrDef = {
        key: r.key,
        name: r.name.trim(),
        type: r.type,
        required: r.required,
      };
      if (r.type === "select") {
        base.options = opts;
      }
      return base;
    });
}

export function AdminCategoriesPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Cat[]>("/api/categories"),
  });

  const parentOptions = useMemo(() => flattenForParentOptions(q.data ?? []), [q.data]);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [schemaModalId, setSchemaModalId] = useState<string | null>(null);
  const [attrRows, setAttrRows] = useState<AttrRow[]>([]);
  const [schemaErr, setSchemaErr] = useState<string | null>(null);

  const schemaDetail = useQuery({
    queryKey: ["category", "public", schemaModalId],
    queryFn: () => apiFetch<CategoryDetailRes>("/api/categories/" + schemaModalId),
    enabled: Boolean(schemaModalId),
  });

  useEffect(() => {
    if (!schemaDetail.data) {
      return;
    }
    setAttrRows(defsToRows(schemaDetail.data.attributeDefinitions));
    setSchemaErr(null);
  }, [schemaDetail.data]);

  const patchSchemaMut = useMutation({
    mutationFn: (vars: { publicId: string; attributeSchema: CategoryAttrDef[] }) =>
      apiFetch<unknown>("/api/admin/categories/" + vars.publicId, {
        method: "PATCH",
        body: JSON.stringify({ attributeSchema: vars.attributeSchema }),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
      void qc.invalidateQueries({ queryKey: ["category", "public", vars.publicId] });
      setSchemaModalId(null);
      setSchemaErr(null);
    },
    onError: (e: Error) => setSchemaErr(e.message),
  });

  const createMut = useMutation({
    mutationFn: () =>
      apiFetch<unknown>("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim(),
          parentPublicId: parentId || undefined,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
      setSlug("");
      setName("");
      setParentId("");
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  const delMut = useMutation({
    mutationFn: (publicId: string) =>
      apiFetch<{ ok: boolean }>("/api/admin/categories/" + publicId, {
        method: "DELETE",
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Categories</h1>
      <p className="mt-2 text-sm text-muted">
        Subcategories must have a valid parent. Delete is blocked if products or children exist.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold">Add category</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Slug *
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-mono text-xs"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. tablets"
            />
          </label>
          <label className="block text-sm">
            Name *
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            Parent (optional)
            <select
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None (root)</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button
          type="button"
          className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          Create
        </button>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold">Tree</h2>
        <div className="mt-4">
          <CategoryTreeRows
            nodes={q.data ?? []}
            depth={0}
            onDelete={(id) => delMut.mutate(id)}
            onEditAttributes={(id) => {
              setSchemaModalId(id);
              setSchemaErr(null);
            }}
          />
        </div>
      </div>

      {schemaModalId ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="flex max-h-[100dvh] w-full flex-1 flex-col overflow-hidden bg-surface sm:max-h-[min(100dvh-2rem,48rem)] sm:max-w-3xl sm:flex-none sm:rounded-2xl sm:border sm:border-border sm:shadow-card">
            <div className="shrink-0 border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Category attributes</h2>
              {schemaDetail.data ? (
                <p className="mt-1 text-sm text-muted">
                  {schemaDetail.data.name}{" "}
                  <span className="font-mono text-xs">({schemaDetail.data.slug})</span>
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
              {schemaDetail.isLoading ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : schemaDetail.isError ? (
                <p className="text-sm text-red-600">Failed to load category.</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <p className="text-muted">
                    Keys must be lowercase letters, digits, and underscores (e.g.{" "}
                    <code className="rounded bg-bg px-1 font-mono text-xs">ram_gb</code>). For
                    select fields, list options separated by commas.
                  </p>
                  <div className="space-y-3">
                    {attrRows.map((row, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border bg-bg/40 p-3 sm:grid sm:grid-cols-12 sm:gap-2 sm:p-4"
                      >
                        <label className="mb-2 block sm:col-span-3">
                          <span className="text-xs text-muted">Key *</span>
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 font-mono text-xs"
                            value={row.key}
                            onChange={(e) => {
                              const next = [...attrRows];
                              next[idx] = { ...row, key: e.target.value };
                              setAttrRows(next);
                            }}
                            placeholder="e.g. ram_gb"
                          />
                        </label>
                        <label className="mb-2 block sm:col-span-3">
                          <span className="text-xs text-muted">Label *</span>
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                            value={row.name}
                            onChange={(e) => {
                              const next = [...attrRows];
                              next[idx] = { ...row, name: e.target.value };
                              setAttrRows(next);
                            }}
                            placeholder="Shown in forms"
                          />
                        </label>
                        <label className="mb-2 block sm:col-span-2">
                          <span className="text-xs text-muted">Type</span>
                          <select
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                            value={row.type}
                            onChange={(e) => {
                              const next = [...attrRows];
                              next[idx] = {
                                ...row,
                                type: e.target.value as AttrRow["type"],
                              };
                              setAttrRows(next);
                            }}
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="boolean">Yes / No</option>
                            <option value="select">Select</option>
                          </select>
                        </label>
                        <label className="mb-2 flex items-end gap-2 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={row.required}
                            onChange={(e) => {
                              const next = [...attrRows];
                              next[idx] = { ...row, required: e.target.checked };
                              setAttrRows(next);
                            }}
                          />
                          <span className="text-xs">Required</span>
                        </label>
                        <div className="sm:col-span-12">
                          {row.type === "select" ? (
                            <label className="block">
                              <span className="text-xs text-muted">Options (comma-separated)</span>
                              <input
                                className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                                value={row.optionsText}
                                onChange={(e) => {
                                  const next = [...attrRows];
                                  next[idx] = { ...row, optionsText: e.target.value };
                                  setAttrRows(next);
                                }}
                                placeholder="4GB, 6GB, 8GB"
                              />
                            </label>
                          ) : null}
                        </div>
                        <div className="mt-2 flex justify-end sm:col-span-12">
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => setAttrRows(attrRows.filter((_, i) => i !== idx))}
                          >
                            Remove row
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
                    onClick={() =>
                      setAttrRows([
                        ...attrRows,
                        {
                          key: "",
                          name: "",
                          type: "text",
                          required: false,
                          optionsText: "",
                        },
                      ])
                    }
                  >
                    Add attribute
                  </button>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border px-5 py-4">
              {schemaErr ? <p className="mb-2 text-sm text-red-600">{schemaErr}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm"
                  onClick={() => {
                    setSchemaModalId(null);
                    setSchemaErr(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={patchSchemaMut.isPending || schemaDetail.isLoading || !schemaModalId}
                  onClick={() => {
                    if (!schemaModalId) {
                      return;
                    }
                    const schema = rowsToSchema(attrRows);
                    patchSchemaMut.mutate({
                      publicId: schemaModalId,
                      attributeSchema: schema,
                    });
                  }}
                >
                  Save schema
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
