import { type Column } from "@/components/data-table";

export type WithCreator = {
  created_by_name: string | null;
  role_name: string | null;
};

export type WithSignedBy = { signed_by_name: string | null };

/** Shared "Signed By" column — the signatory, which may differ from the creator. */
export function signedByColumn<T extends WithSignedBy>(): Column<T> {
  return {
    key: "signed_by_name",
    label: "Signed By",
    value: (r) => r.signed_by_name,
    render: (r) => <span className="text-fg">{r.signed_by_name || "—"}</span>,
  };
}

/** Shared "Created By" + "Role" columns for list tables that resolve the
 *  creating user + their role (e.g. KFC Form 13, Documents). Reuse instead of
 *  redefining the same two columns per table. */
export function creatorColumns<T extends WithCreator>(): Column<T>[] {
  return [
    {
      key: "created_by_name",
      label: "Created By",
      value: (r) => r.created_by_name,
      render: (r) => (
        <span className="text-fg">{r.created_by_name || "—"}</span>
      ),
    },
    {
      key: "role_name",
      label: "Role",
      value: (r) => r.role_name,
      render: (r) =>
        r.role_name ? (
          <span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-fg">
            {r.role_name}
          </span>
        ) : (
          "—"
        ),
    },
  ];
}
