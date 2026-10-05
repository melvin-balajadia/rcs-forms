import PageHeader from "@/components/page-header";
import { LuLayoutDashboard } from "react-icons/lu";
import AnalyticsSection from "./analytics/AnalyticsSection";

export default function Dashboard() {
  return (
    <div className="mx-6 mt-5 mb-8">
      <PageHeader
        icon={<LuLayoutDashboard className="text-2xl text-font-main" />}
        title="Dashboard"
        variant="default"
      />

      {/* Filter bar + every widget the user's role gets */}
      <AnalyticsSection />
    </div>
  );
}
