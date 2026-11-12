"use client";

/* eslint-disable @next/next/no-img-element -- Direct user URLs preserve animated GIF playback and avoid mandatory remote-image configuration. */

import { useState, type ReactNode } from "react";
import { ChevronDown, Dumbbell, ImageOff, LoaderCircle } from "lucide-react";
import type { ExercisePlanInput } from "@/lib/plans/schema";

type EquipmentDetails = ExercisePlanInput["equipmentDetails"];
type ExerciseMedia = ExercisePlanInput["media"];

export function ExerciseDemonstration({ media, legacyImageUrl, legacyVideoUrl }: { media?: ExerciseMedia | null; legacyImageUrl?: string | null; legacyVideoUrl?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const effectiveMedia = media?.type && media.type !== "none" ? media : legacyVideoUrl ? { ...media, type: "video" as const, videoUrl: legacyVideoUrl } : legacyImageUrl ? { ...media, type: "image" as const, thumbnailUrl: legacyImageUrl } : media;
  const src = effectiveMedia?.type === "gif" ? effectiveMedia.animationUrl ?? effectiveMedia.thumbnailUrl : effectiveMedia?.type === "image" ? effectiveMedia.thumbnailUrl ?? effectiveMedia.animationUrl : effectiveMedia?.type === "none" ? effectiveMedia.thumbnailUrl ?? effectiveMedia.animationUrl : effectiveMedia?.thumbnailUrl ?? null;
  const video = effectiveMedia?.type === "video" ? effectiveMedia.videoUrl : null;
  return <details className="exercise-extra"><summary>Exercise Demonstration <ChevronDown size={14} /></summary><div className="exercise-extra-content">
    {failed ? <MediaPlaceholder>Demonstration media could not be loaded. Check the URL or try again later.</MediaPlaceholder> : video ? <div className="exercise-media-frame">{loading && <MediaLoading />}<video controls playsInline preload="metadata" poster={effectiveMedia?.thumbnailUrl ?? undefined} aria-label={effectiveMedia?.altText ?? "Exercise demonstration video"} onLoadStart={() => setLoading(true)} onLoadedData={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }}><source src={video} /></video></div> : src ? <div className="exercise-media-frame">{loading && <MediaLoading />}<img src={src} alt={effectiveMedia?.altText ?? "Exercise demonstration"} onLoad={() => setLoading(false)} onLoadStart={() => setLoading(true)} onError={() => { setLoading(false); setFailed(true); }} /></div> : <MediaPlaceholder>No demonstration media is configured for this exercise.</MediaPlaceholder>}
    {(media?.sourceName || media?.attribution || media?.sourceUrl) && <p className="exercise-attribution">{media.attribution}{media.attribution && (media.sourceName || media.sourceUrl) ? " · " : ""}{media.sourceUrl ? <a href={media.sourceUrl} target="_blank" rel="noreferrer">{media.sourceName ?? "Media source"}</a> : media.sourceName}</p>}
  </div></details>;
}

export function EquipmentInformation({ details, legacyEquipment = [] }: { details?: EquipmentDetails | null; legacyEquipment?: string[] }) {
  const primary = details?.primaryEquipment || legacyEquipment.filter(Boolean).join(", ");
  const machine = details?.machineName || primary;
  const alternatives = Array.isArray(details?.alternativeEquipment) ? details.alternativeEquipment : typeof details?.alternativeEquipment === "string" ? details.alternativeEquipment.split(",").map((entry) => entry.trim()).filter(Boolean) : [];
  const hasDetails = Boolean(primary || machine || details?.equipmentType || alternatives.length || details?.setupInstructions || details?.equipmentImageUrl);
  return <details className="exercise-extra"><summary><Dumbbell size={14} /> Equipment information <ChevronDown size={14} /></summary><div className="exercise-extra-content equipment-information">
    {!hasDetails && <p>Equipment details have not been provided for this exercise.</p>}
    {primary && <p><strong>Primary equipment</strong>{primary}</p>}{machine && <p><strong>Machine</strong>{machine}</p>}{details?.equipmentType && <p><strong>Equipment type</strong>{details.equipmentType}</p>}{alternatives.length > 0 && <p><strong>Alternative equipment</strong>{alternatives.join(", ")}</p>}{details?.setupInstructions && <p><strong>Setup instructions</strong>{details.setupInstructions}</p>}
    {details?.equipmentImageUrl && <EquipmentImage src={details.equipmentImageUrl} alt={machine ? `${machine} equipment` : "Exercise equipment"} />}
  </div></details>;
}

function EquipmentImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false); const [loading, setLoading] = useState(true);
  if (failed) return <MediaPlaceholder>Equipment image could not be loaded.</MediaPlaceholder>;
  return <div className="exercise-media-frame equipment-media-frame">{loading && <MediaLoading />}<img src={src} alt={alt} onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} /></div>;
}

function MediaLoading() { return <span className="exercise-media-loading" role="status"><LoaderCircle className="spin" size={18} /> Loading media…</span>; }
function MediaPlaceholder({ children }: { children: ReactNode }) { return <div className="exercise-media-placeholder"><ImageOff size={17} /><span>{children}</span></div>; }
