export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Strips the global header chrome — pure form surface for iframes.
  return <>{children}</>;
}
