"use client";

/**
 * Custom loader for next/image that delegates ALL delivery transformations to
 * Cloudinary's edge CDN and bypasses the Next.js image optimizer entirely.
 *
 * Why: the backend stores the original Cloudinary URL (without width/quality
 * transforms), so with the default loader every image is fetched full-size and
 * re-transcoded by the Next server on first request — a single-node CPU
 * bottleneck that scales badly once there are many product images. With this
 * loader the browser requests the exact width + WebP/AVIF straight from the
 * Cloudinary CDN, so there is no server-side transcode and no growing origin
 * image cache.
 *
 * Non-Cloudinary URLs (same-origin /uploads/... local fallback, or data: URIs
 * in the upload preview) are returned untouched so nothing breaks.
 */

const CLOUDINARY_HOST = "https://res.cloudinary.com/";
const CLOUDINARY_DELIVERY_MARKER = "/image/upload/";

type ImageLoaderProps = {
  src: string;
  width: number;
  quality?: number | string;
};

export default function imageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  // Only rewrite real Cloudinary delivery URLs; leave local/data assets alone.
  if (
    !src.startsWith(CLOUDINARY_HOST) ||
    !src.includes(CLOUDINARY_DELIVERY_MARKER)
  ) {
    return src;
  }

  const transforms = [
    "f_auto", // let Cloudinary negotiate the best format (WebP/AVIF) per browser
    "c_limit", // keep aspect ratio; only downscale (never upscale or crop)
    `w_${Math.round(width)}`, // resize to the width next/image asked for
    // next/image passes quality=75 by default; map the framework default (and
    // "auto") to Cloudinary's content-aware q_auto, but honor an explicit value.
    quality === "auto" || quality == null || quality === 75
      ? "q_auto"
      : `q_${quality}`,
  ].join(",");

  return src.replace(
    CLOUDINARY_DELIVERY_MARKER,
    `${CLOUDINARY_DELIVERY_MARKER}${transforms}/`,
  );
}
