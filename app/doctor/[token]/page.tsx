import PlaceholderPage from "@/components/PlaceholderPage";

// Read-only doctor summary, opened via a shareable link. Built in Step 7.
export default async function DoctorPage(props: PageProps<"/doctor/[token]">) {
  const { token } = await props.params;

  return (
    <PlaceholderPage
      icon="🩺"
      titleKey="doctorTitle"
      textKey="doctorPlaceholder"
      detail={{ labelKey: "doctorLinkCode", value: token }}
    />
  );
}
