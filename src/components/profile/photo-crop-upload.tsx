/**
 * PhotoCropUpload — square center-crop preview built on plain <canvas>.
 *
 * Flow:
 *   1. User picks a file (accept="image/*").
 *   2. We render a live square crop preview at 256px.
 *   3. On confirm, we upload the cropped WEBP to Supabase Storage under
 *      `avatars/<userId>/avatar.webp` (overwrites), then notify parent
 *      with the storage path so the server fn can record it.
 *
 * No third-party crop library — keeps bundle small and dependency surface
 * minimal.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const OUTPUT_SIZE = 512;
const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export function PhotoCropUpload({
  userId,
  currentSrc,
  onUploaded,
}: {
  userId: string;
  currentSrc: string | null;
  onUploaded: (path: string, signedUrl: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Choose an image file (JPG, PNG, WEBP).");
      return;
    }
    if (f.size > MAX_INPUT_BYTES) {
      toast.error("Image is larger than 5 MB.");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      drawSquareCrop(img);
    };
    img.src = url;
  }

  function drawSquareCrop(img: HTMLImageElement) {
    const c = canvasRef.current;
    if (!c) return;
    c.width = OUTPUT_SIZE;
    c.height = OUTPUT_SIZE;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - size) / 2;
    const sy = (img.naturalHeight - size) / 2;
    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  }

  async function confirmUpload() {
    const c = canvasRef.current;
    if (!c || !file) return;
    setUploading(true);
    try {
      const blob: Blob = await new Promise((resolve, reject) =>
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/webp", 0.9),
      );
      const path = `${userId}/avatar.webp`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/webp" });
      if (error) throw error;
      const { setMyProfilePhoto } = await import("@/lib/profile.functions");
      const res = await setMyProfilePhoto({ data: { path } });
      onUploaded(path, res.signedUrl);
      toast.success("Photo updated");
      cancel();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function cancel() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    imgRef.current = null;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        aria-hidden={!currentSrc && !file}
        className="grid size-36 place-items-center overflow-hidden rounded-full border-2 border-border bg-muted"
      >
        {file ? (
          <canvas ref={canvasRef} className="size-full object-cover" />
        ) : currentSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentSrc} alt="Profile photo" className="size-full object-cover" />
        ) : (
          <span className="text-3xl font-semibold text-muted-foreground" aria-hidden>
            ?
          </span>
        )}
      </div>

      {file ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={confirmUpload} disabled={uploading}>
            {uploading ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : <Upload className="mr-1 size-4" aria-hidden />}
            Save photo
          </Button>
          <Button size="sm" variant="outline" onClick={cancel} disabled={uploading}>
            <X className="mr-1 size-4" aria-hidden /> Cancel
          </Button>
        </div>
      ) : (
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
            <Upload className="size-4" aria-hidden /> Change photo
          </span>
        </label>
      )}
      <p className="text-center text-[11px] text-muted-foreground">
        Square center crop, PNG/JPG/WEBP up to 5 MB.
      </p>
    </div>
  );
}
