import PatientApp from "@/components/patient/PatientApp";

// Patient check-in screen. Opened from the personal link: /patient?id=<patient id>
export default async function PatientPage(props: PageProps<"/patient">) {
  const { id } = await props.searchParams;
  return <PatientApp linkId={typeof id === "string" ? id : null} />;
}
