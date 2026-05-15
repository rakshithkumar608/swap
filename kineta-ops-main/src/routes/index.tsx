import { createFileRoute } from "@tanstack/react-router";
import { StatusBar } from "@/components/resq/StatusBar";
import { Sidebar, MobileNavDrawer, MobileBottomNav } from "@/components/resq/Sidebar";
import { RightPanel } from "@/components/resq/RightPanel";
import { EmergencyButton, EmergencyOverlay } from "@/components/resq/EmergencySystem";
import { Onboarding } from "@/components/resq/Onboarding";
import { ActiveView, ViewBreadcrumb } from "@/components/resq/Views";
import { useResqStore } from "@/store/useResqStore";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { activeView, powerSaver } = useResqStore();
  const isCommand = activeView === "command";

  return (
    <div className={`dark fixed inset-0 flex flex-col text-foreground ${powerSaver ? "saturate-50" : ""}`}>
      <StatusBar />
      <ViewBreadcrumb />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 relative min-w-0 flex flex-col">
          <div className="flex-1 relative min-h-0">
            <ActiveView />
          </div>
        </main>
        {/* Right panel only on Command + desktop */}
        {isCommand && <div className="hidden xl:flex"><RightPanel /></div>}
      </div>

      <MobileNavDrawer />
      <MobileBottomNav />
      <EmergencyButton />
      <EmergencyOverlay />
      <Onboarding />
    </div>
  );
}
