import CaregiverApp from "@/components/caregiver/CaregiverApp";

// Caregiver area: setup wizard and dashboard. "/caregiver?demo=1" loads the demo (Mrs. Chan).
export default async function CaregiverPage(props: PageProps<"/caregiver">) {
  const { demo, accountDeleted } = await props.searchParams;
  return <CaregiverApp startDemo={demo === "1"} accountDeleted={accountDeleted === "1"} />;
}
