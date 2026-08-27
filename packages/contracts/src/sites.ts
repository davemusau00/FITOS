export type SitePageStatus = "draft" | "published";
export type SiteSection = {
  type: "hero" | "rich_text" | "cta" | "service_grid" | "schedule";
  [key: string]: unknown;
};
export interface SitePageResponse {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  status: SitePageStatus;
  sections: SiteSection[];
  seo: Record<string, unknown>;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SaveSitePageRequest {
  slug: string;
  title: string;
  sections: SiteSection[];
  seo?: Record<string, unknown>;
}
