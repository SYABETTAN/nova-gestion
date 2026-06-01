"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import { MEMBER_STATUS_LABELS, ROLE_LABELS } from "@/lib/app-labels";
import type { SessionUser } from "@/lib/permissions";
import {
  inviteMemberAction,
  updateMemberRoleAction,
  updateMemberStatusAction,
} from "@/server/actions/member.actions";
import { revokeInvitationAction } from "@/server/actions/invitation.actions";
import { formatDateShort } from "@/lib/utils";

type Member = {
  id: string;
  status: string;
  joinedAt: Date | null;
  createdAt: Date;
  user: { id: string; name: string; email: string };
  role: { key: string; name: string };
};

type Invitation = {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  role: { key: string; name: string };
};

type TeamPageClientProps = {
  user: SessionUser;
  members: Member[];
  invitations: Invitation[];
};

const ROLES = ["OWNER", "ADMIN", "ACCOUNTANT", "SALES", "READ_ONLY"] as const;

export function TeamPageClient({ user, members, invitations }: TeamPageClientProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteRole, setInviteRole] = useState("SALES");

  async function handleInvite(formData: FormData) {
    setLoading(true);
    const result = await inviteMemberAction(formData);
    setLoading(false);
    if (result.success) {
      toast.success(result.message ?? "Invitation envoyée par email");
      setInviteLink(result.invitationLink ?? null);
      setInviteOpen(false);
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleRoleChange(memberId: string, roleKey: string) {
    const formData = new FormData();
    formData.set("memberId", memberId);
    formData.set("roleKey", roleKey);
    const result = await updateMemberRoleAction(formData);
    if (result.success) toast.success("Rôle mis à jour");
    else toast.error(result.error ?? "Erreur");
  }

  async function handleStatusChange(memberId: string, status: "ACTIVE" | "SUSPENDED") {
    const formData = new FormData();
    formData.set("memberId", memberId);
    formData.set("status", status);
    const result = await updateMemberStatusAction(formData);
    if (result.success) {
      toast.success(status === "SUSPENDED" ? "Membre suspendu" : "Membre réactivé");
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    const result = await revokeInvitationAction(invitationId);
    if (result.success) toast.success("Invitation révoquée");
    else toast.error(result.error ?? "Erreur");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Équipe</h1>
          <p className="text-[var(--color-muted-foreground)]">
            Gérez les membres de votre organisation
          </p>
        </div>
        <PermissionGate user={user} permission="MEMBERS_INVITE">
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>Inviter un membre</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inviter un membre</DialogTitle>
                <DialogDescription>
                  Un email d&apos;invitation sera envoyé avec un lien sécurisé.
                </DialogDescription>
              </DialogHeader>
              <form action={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input id="invite-email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Rôle</Label>
                  <input type="hidden" name="roleKey" value={inviteRole} />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => r !== "OWNER").map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Envoi..." : "Envoyer l'invitation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {inviteLink && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
          <p className="font-medium text-blue-900">Lien d&apos;invitation (secours si l&apos;email n&apos;arrive pas) :</p>
          <code className="mt-1 block text-blue-700">{inviteLink}</code>
        </div>
      )}

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date d&apos;ajout</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.user.name}</TableCell>
                <TableCell>{member.user.email}</TableCell>
                <TableCell>{ROLE_LABELS[member.role.key] ?? member.role.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      member.status === "ACTIVE"
                        ? "success"
                        : member.status === "SUSPENDED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {MEMBER_STATUS_LABELS[member.status] ?? member.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateShort(member.joinedAt ?? member.createdAt)}</TableCell>
                <TableCell>
                  <PermissionGate user={user} permission="MEMBERS_UPDATE">
                    <Select
                      defaultValue={member.role.key}
                      onValueChange={(v) => handleRoleChange(member.id, v)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </PermissionGate>
                  <PermissionGate user={user} permission="MEMBERS_SUSPEND">
                    {member.status === "ACTIVE" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={() => handleStatusChange(member.id, "SUSPENDED")}
                      >
                        Suspendre
                      </Button>
                    ) : member.status === "SUSPENDED" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={() => handleStatusChange(member.id, "ACTIVE")}
                      >
                        Réactiver
                      </Button>
                    ) : null}
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {invitations.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Invitations en attente</h2>
          <div className="rounded-xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead>Date d&apos;envoi</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>{ROLE_LABELS[inv.role.key]}</TableCell>
                    <TableCell>{formatDateShort(inv.expiresAt)}</TableCell>
                    <TableCell>{formatDateShort(inv.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <PermissionGate user={user} permission="MEMBERS_INVITE">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeInvitation(inv.id)}
                        >
                          Révoquer
                        </Button>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
