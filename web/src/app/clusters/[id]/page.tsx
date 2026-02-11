import { redirect } from "next/navigation";

export default async function ClusterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?cluster=${id}`);
}
