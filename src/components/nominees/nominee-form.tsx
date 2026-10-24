"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NomineeFormInitial = {
  name: string;
  email: string;
  relationship: string;
};

type NomineeFormProps =
  | { mode: "create" }
  | { mode: "edit"; nomineeId: string; initial: NomineeFormInitial };

type ApiErrorResponse = {
  error?: string;
  code?: string;
  fields?: Record<string, string>;
  id?: string;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function NomineeForm(props: NomineeFormProps) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.initial : null;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [relationship, setRelationship] = useState(initial?.relationship ?? "");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);

    const payload: Record<string, unknown> = { name, relationship };
    if (!isEdit) payload.email = email;

    try {
      const response = await fetch(
        isEdit ? `/api/nominees/${props.nomineeId}` : "/api/nominees",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | null;

      if (!response.ok) {
        if (response.status === 400 && data?.fields) {
          setFieldErrors(data.fields);
        }
        setFormError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setOpen(false);
      if (!isEdit) {
        setName("");
        setEmail("");
        setRelationship("");
      }
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Add nominee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit nominee" : "Add nominee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the name or relationship. The email is locked so records stay consistent."
              : "Nominees you add here can later be invited to specific assets. No asset access is granted yet."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="nominee-name">
              Name <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="nominee-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Maya Iqbal"
              maxLength={80}
              required
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={
                fieldErrors.name ? "nominee-name-error" : undefined
              }
            />
            <FieldError id="nominee-name-error" message={fieldErrors.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nominee-email">
              Email {!isEdit && <span aria-hidden="true">*</span>}
            </Label>
            <Input
              id="nominee-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nominee@example.com"
              maxLength={254}
              required={!isEdit}
              readOnly={isEdit}
              disabled={isEdit}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={
                fieldErrors.email
                  ? "nominee-email-error"
                  : "nominee-email-help"
              }
            />
            <p
              id="nominee-email-help"
              className="text-xs text-muted-foreground"
            >
              {isEdit
                ? "Email cannot be changed after creation."
                : "Used to match an existing account for in-app invitations. If the email matches a registered account, they will receive an in-app invitation notification when you invite them to an asset. Never store passwords or recovery secrets here."}
            </p>
            <FieldError id="nominee-email-error" message={fieldErrors.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nominee-relationship">Relationship</Label>
            <Input
              id="nominee-relationship"
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
              placeholder="e.g. Sibling, Friend, Lawyer"
              maxLength={80}
              aria-invalid={fieldErrors.relationship ? true : undefined}
              aria-describedby={
                fieldErrors.relationship ? "nominee-relationship-error" : undefined
              }
            />
            <FieldError
              id="nominee-relationship-error"
              message={fieldErrors.relationship}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add nominee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
