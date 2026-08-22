import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, StatusBadge } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function SitesPage() {
  const cache = useQueryClient(); const pages = useQuery({ queryKey: ["site-pages"], queryFn: api.sitePages });
  const [title, setTitle] = useState("Home"); const [slug, setSlug] = useState("home"); const [hero, setHero] = useState("Everything fitness. One OS.");
  const save = useMutation({ mutationFn: () => api.saveSitePage({ title, slug, sections: [{ type: "hero", heading: hero }] }), onSuccess: () => void cache.invalidateQueries({ queryKey: ["site-pages"] }) });
  const publish = useMutation({ mutationFn: api.publishSitePage, onSuccess: () => void cache.invalidateQueries({ queryKey: ["site-pages"] }) });
  if (pages.isLoading) return <PageLoading />;
  return <><PageHeader title="FITOS Sites" description="Draft and publish controlled tenant website pages." /><ErrorNotice error={pages.error || save.error || publish.error} /><div className="two-column-grid"><Card><h2>Page editor</h2><div className="form-stack"><label>Page title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Page slug<input value={slug} onChange={(e) => setSlug(e.target.value)} /></label><label>Hero heading<textarea value={hero} onChange={(e) => setHero(e.target.value)} /></label><Button onClick={() => save.mutate()} loading={save.isPending}>Save draft</Button></div></Card><Card><h2>Pages</h2>{(pages.data ?? []).map((page) => <div key={page.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".75rem 0" }}><span><strong>{page.title}</strong><br /><small>/{page.slug} · v{page.version}</small></span><span style={{ display: "flex", gap: ".5rem", alignItems: "center" }}><StatusBadge status={page.status} />{page.status !== "published" && <Button size="small" onClick={() => publish.mutate(page.id)}>Publish</Button>}</span></div>)}{!pages.data?.length && <p className="muted">No pages created yet.</p>}</Card></div></>;
}
