import { EntityProfile } from "@/components/entity/EntityProfile";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EntityPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <EntityProfile entityId={id} />
    </div>
  );
}
