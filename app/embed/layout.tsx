export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The root layout paints body with `bg-background`, which resolves to
  // `#ffffff` in light mode. An embed iframe inside a dark host page
  // shows that white through any transparent form theme for visitors
  // whose browser/OS reports a light color scheme — the "card branco
  // em alguns navegadores" report. Forcing html/body transparent makes
  // the host page's background read through reliably.
  return (
    <>
      <style href="spark-embed-transparent" precedence="high">
        {`html,body{background:transparent!important}`}
      </style>
      {children}
    </>
  );
}
