import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, StatusBadge } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export type SiteBlockType =
  | "hero"
  | "feature_grid"
  | "services_list"
  | "schedule_embed"
  | "trainer_profiles"
  | "testimonials"
  | "cta_banner"
  | "contact_form";

export interface SiteBlock {
  id: string;
  type: SiteBlockType;
  heading?: string;
  subheading?: string;
  ctaText?: string;
  ctaLink?: string;
  items?: Array<{ title: string; desc: string; icon?: string }>;
  accentColor?: string;
}

const DEFAULT_BLOCKS: SiteBlock[] = [
  {
    id: "b-1",
    type: "hero",
    heading: "Elevate Your Potential",
    subheading: "High-performance training, pilates and recovery protocols under one roof.",
    ctaText: "Book a Trial Session",
    ctaLink: "#schedule"
  },
  {
    id: "b-2",
    type: "feature_grid",
    heading: "World-Class Facilities",
    items: [
      {
        title: "Olympic Lifting",
        desc: "Eleiko barbells, calibrated plates & power cages.",
        icon: "🏋️"
      },
      {
        title: "Reformer Pilates",
        desc: "12 Allegro 2 Reformers with certified instructors.",
        icon: "🧘"
      },
      { title: "Diagnostic Lab", desc: "InBody 970 segmental BIA and VALD ForceDecks.", icon: "🔬" }
    ]
  },
  {
    id: "b-3",
    type: "schedule_embed",
    heading: "Live Studio Timetable",
    subheading: "Real-time spot availability and instant reservation."
  },
  {
    id: "b-4",
    type: "cta_banner",
    heading: "Ready to Train Differently?",
    subheading: "Join our active community with a 7-day complimentary pass.",
    ctaText: "Claim Your Pass",
    ctaLink: "#contact"
  }
];

export function SitesPage() {
  const cache = useQueryClient();
  const pages = useQuery({ queryKey: ["site-pages"], queryFn: api.sitePages });

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [title, setTitle] = useState("Home Page");
  const [slug, setSlug] = useState("home");
  const [blocks, setBlocks] = useState<SiteBlock[]>(DEFAULT_BLOCKS);
  const [metaTitle, setMetaTitle] = useState("FITOS Gym | Everything Fitness");
  const [metaDesc, setMetaDesc] = useState(
    "Book group classes, physical therapy and diagnostic scans."
  );
  const [activeTab, setActiveTab] = useState<"blocks" | "theme" | "seo">("blocks");
  const [themeColor, setThemeColor] = useState("#3b82f6");

  const save = useMutation({
    mutationFn: () =>
      api.saveSitePage({
        title,
        slug,
        sections: blocks as any,
        seo: { title: metaTitle, description: metaDesc, themeColor }
      }),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["site-pages"] })
  });

  const publish = useMutation({
    mutationFn: api.publishSitePage,
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["site-pages"] })
  });

  const addBlock = (type: SiteBlockType) => {
    const newBlock: SiteBlock = {
      id: `block-${Date.now()}`,
      type,
      heading:
        type === "hero"
          ? "New Hero Headline"
          : type === "services_list"
            ? "Our Signature Services"
            : type === "testimonials"
              ? "What Our Athletes Say"
              : type === "trainer_profiles"
                ? "Meet the Coaching Staff"
                : type === "contact_form"
                  ? "Get in Touch"
                  : "New Section",
      subheading: "Customizable subtext describing this facility feature.",
      ctaText: "Get Started",
      ctaLink: "#",
      items:
        type === "feature_grid"
          ? [
              { title: "Feature 1", desc: "Description of benefit", icon: "✨" },
              { title: "Feature 2", desc: "Description of benefit", icon: "⚡" },
              { title: "Feature 3", desc: "Description of benefit", icon: "🎯" }
            ]
          : []
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const next = [...blocks];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    const temp = next[index];
    const replacement = next[target];
    if (!temp || !replacement) return;
    next[index] = replacement;
    next[target] = temp;
    setBlocks(next);
  };

  const updateBlockField = (id: string, field: keyof SiteBlock, value: any) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  if (pages.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        title="FITOS Sites CMS"
        description="Build, theme and publish modular member websites and timetables with live database feeds."
      />
      <ErrorNotice error={pages.error || save.error || publish.error} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Editor Main */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.08))",
                paddingBottom: "1rem",
                marginBottom: "1.25rem"
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => setActiveTab("blocks")}
                  className={`fitos-button ${activeTab === "blocks" ? "fitos-button--primary" : "fitos-button--secondary"}`}
                  style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  Block Builder ({blocks.length})
                </button>
                <button
                  onClick={() => setActiveTab("theme")}
                  className={`fitos-button ${activeTab === "theme" ? "fitos-button--primary" : "fitos-button--secondary"}`}
                  style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  Theme & Colors
                </button>
                <button
                  onClick={() => setActiveTab("seo")}
                  className={`fitos-button ${activeTab === "seo" ? "fitos-button--primary" : "fitos-button--secondary"}`}
                  style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  SEO & Meta
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button onClick={() => save.mutate()} loading={save.isPending}>
                  Save Draft
                </Button>
              </div>
            </div>

            {activeTab === "blocks" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label>
                    Page Title
                    <input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </label>
                  <label>
                    URL Slug
                    <input value={slug} onChange={(e) => setSlug(e.target.value)} />
                  </label>
                </div>

                {/* Blocks list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <h3 style={{ fontSize: "1rem", margin: 0 }}>Sections on this Page</h3>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {(
                        [
                          "hero",
                          "feature_grid",
                          "services_list",
                          "schedule_embed",
                          "trainer_profiles",
                          "testimonials",
                          "cta_banner",
                          "contact_form"
                        ] as const
                      ).map((type) => (
                        <button
                          key={type}
                          onClick={() => addBlock(type)}
                          style={{
                            padding: "0.3rem 0.6rem",
                            fontSize: "0.75rem",
                            borderRadius: "0.3rem",
                            background: "rgba(59, 130, 246, 0.15)",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            color: "#60a5fa",
                            cursor: "pointer"
                          }}
                        >
                          + {type.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {blocks.map((block, idx) => (
                    <div
                      key={block.id}
                      style={{
                        background: "rgba(30, 41, 59, 0.5)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "0.75rem",
                        padding: "1.25rem"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.75rem"
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "#60a5fa",
                            background: "rgba(59, 130, 246, 0.15)",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.25rem"
                          }}
                        >
                          {idx + 1}. {block.type.replace("_", " ")}
                        </span>
                        <div style={{ display: "flex", gap: "0.3rem" }}>
                          <button
                            type="button"
                            onClick={() => moveBlock(idx, "up")}
                            disabled={idx === 0}
                            style={{
                              padding: "0.2rem 0.5rem",
                              background: "none",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#fff",
                              cursor: "pointer",
                              borderRadius: "0.2rem"
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBlock(idx, "down")}
                            disabled={idx === blocks.length - 1}
                            style={{
                              padding: "0.2rem 0.5rem",
                              background: "none",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#fff",
                              cursor: "pointer",
                              borderRadius: "0.2rem"
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            style={{
                              padding: "0.2rem 0.5rem",
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "1px solid rgba(239, 68, 68, 0.4)",
                              color: "#f87171",
                              cursor: "pointer",
                              borderRadius: "0.2rem"
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <label style={{ fontSize: "0.85rem" }}>
                          Section Heading
                          <input
                            value={block.heading ?? ""}
                            onChange={(e) => updateBlockField(block.id, "heading", e.target.value)}
                          />
                        </label>
                        <label style={{ fontSize: "0.85rem" }}>
                          Subtext / Description
                          <input
                            value={block.subheading ?? ""}
                            onChange={(e) =>
                              updateBlockField(block.id, "subheading", e.target.value)
                            }
                          />
                        </label>
                        {(block.type === "hero" || block.type === "cta_banner") && (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "0.75rem"
                            }}
                          >
                            <label style={{ fontSize: "0.85rem" }}>
                              Button Label
                              <input
                                value={block.ctaText ?? ""}
                                onChange={(e) =>
                                  updateBlockField(block.id, "ctaText", e.target.value)
                                }
                              />
                            </label>
                            <label style={{ fontSize: "0.85rem" }}>
                              Button Target Link
                              <input
                                value={block.ctaLink ?? ""}
                                onChange={(e) =>
                                  updateBlockField(block.id, "ctaLink", e.target.value)
                                }
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "theme" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <label>
                  Brand Accent Color
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    style={{ height: "42px", padding: "2px", width: "100%" }}
                  />
                </label>
                <div
                  style={{
                    background: "rgba(30, 41, 59, 0.6)",
                    padding: "1rem",
                    borderRadius: "0.5rem"
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#cbd5e1" }}>
                    Theme styles apply automatically to both the public site renderer and member
                    portal headers.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "seo" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <label>
                  Meta Title Tag
                  <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
                </label>
                <label>
                  Meta Description
                  <textarea
                    rows={3}
                    value={metaDesc}
                    onChange={(e) => setMetaDesc(e.target.value)}
                  />
                </label>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar: Page List & Status */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <Card>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Published Pages</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(pages.data ?? []).map((page) => (
                <div
                  key={page.id}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    background:
                      selectedPageId === page.id
                        ? "rgba(59, 130, 246, 0.2)"
                        : "rgba(30, 41, 59, 0.4)",
                    border:
                      selectedPageId === page.id
                        ? "1px solid #3b82f6"
                        : "1px solid rgba(255,255,255,0.06)"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.25rem"
                    }}
                  >
                    <strong>{page.title}</strong>
                    <StatusBadge status={page.status} />
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#94a3b8",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <span>
                      /{page.slug} · v{page.version}
                    </span>
                    {page.status !== "published" && (
                      <Button
                        size="small"
                        onClick={() => publish.mutate(page.id)}
                        loading={publish.isPending}
                      >
                        Publish
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!pages.data?.length && (
                <p className="muted" style={{ fontSize: "0.9rem" }}>
                  No pages published yet.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
