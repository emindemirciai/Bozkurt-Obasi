import DashboardClient from "./DashboardClient";
import {
  getAnalyzeSiteConfig,
  toAnalyzeSitePublicConfig,
} from "../lib/siteConfig";

export const dynamic = "force-dynamic";

export default async function Page() {
  const site = getAnalyzeSiteConfig();

  return <DashboardClient site={toAnalyzeSitePublicConfig(site)} />;
}
