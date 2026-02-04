import { DocumentTable } from "@/components/documents/DocumentTable";

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Document Explorer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse all cataloged documents from the DOJ Epstein Library.
        </p>
      </div>

      <DocumentTable />
    </div>
  );
}
