import { getAnalyzeSiteConfig } from '../../../lib/siteConfig';

export function GET() {
  const site = getAnalyzeSiteConfig();

  return Response.json({ ok: true, name: site.healthName, site: site.id });
}
