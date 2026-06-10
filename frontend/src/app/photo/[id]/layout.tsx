import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { imageUrl } from "@/lib/imageUrl";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const SITE_URL = "https://www.photoplombieres.eu";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data: photo } = await supabase
    .from("photos")
    .select("title, description, src, village, year")
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (!photo) {
    return { title: "Photo introuvable — Plombières en Images" };
  }

  const title = `${photo.title} — Plombières en Images`;
  const description =
    photo.description ||
    `Photo de ${photo.village}${photo.year ? `, ${photo.year}` : ""} — archive patrimoniale de Plombières.`;
  const image = imageUrl(photo.src, "medium") || `${SITE_URL}/og-default.jpg`;
  const url = `${SITE_URL}/photo/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Plombières en Images",
      images: [{ url: image, width: 900, height: 600, alt: photo.title }],
      locale: "fr_BE",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
