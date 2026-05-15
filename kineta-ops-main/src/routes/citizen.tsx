import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@/components/ClientOnly";
import { CitizenApp } from "@/components/citizen/CitizenApp";

export const Route = createFileRoute("/citizen")({
  component: CitizenPage,
});

function CitizenPage() {
  return (
    <ClientOnly
      fallback={
        <div className="dark flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
          Loading citizen panel…
        </div>
      }
    >
      {/* Ops shell uses body overflow:hidden; this scrollport restores vertical scroll for /citizen */}
      <div className="dark fixed inset-0 z-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
        <CitizenApp />
      </div>
    </ClientOnly>
  );
}
