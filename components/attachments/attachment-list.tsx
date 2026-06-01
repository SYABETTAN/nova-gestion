import { AttachmentCard } from "@/components/attachments/attachment-card";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  type: string;
  createdAt: Date;
};

export function AttachmentList({
  attachments,
  emptyMessage = "Aucune pièce jointe",
}: {
  attachments: Attachment[];
  emptyMessage?: string;
}) {
  if (attachments.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">{emptyMessage}</p>;
  }
  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <AttachmentCard key={a.id} attachment={a} />
      ))}
    </div>
  );
}
