import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { AttachmentTypeBadge } from "@/components/attachments/attachment-type-badge";
import { formatFileSize } from "@/lib/documents/document-utils";
import { getSupplierAttachmentApiPath } from "@/lib/files";
import { Button } from "@/components/ui/button";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  type: string;
  createdAt: Date;
};

export function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const downloadHref = getSupplierAttachmentApiPath(attachment.id);

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <FileText className="mt-0.5 h-5 w-5 text-slate-500" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">{attachment.fileName}</span>
          <AttachmentTypeBadge type={attachment.type} />
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {attachment.mimeType} — {formatFileSize(attachment.sizeBytes)}
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={downloadHref} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" />
          Télécharger
        </Link>
      </Button>
    </div>
  );
}
