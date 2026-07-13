import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roleMasterT, departmentMasterT, collegeT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

// Ports RoleController (masters/role) — CRUD for role_master_t.
const columns: ColumnDef[] = [
  { key: "role_name", label: "Role Name" },
  { key: "department_name", label: "Department" },
  { key: "office_name", label: "Office" },
  { key: "parent_role_name", label: "Parent Role" },
  { key: "approval_level", label: "Approval Level" },
  { key: "permissions", label: "Permissions" },
  { key: "display", label: "Status", badge: true },
];

const YES_NO = [
  { value: 1, label: "Yes" },
  { value: 0, label: "No" },
];

export default async function RolePage() {
  const [roles, departments, offices] = await Promise.all([
    db.select().from(roleMasterT).orderBy(desc(roleMasterT.id)),
    db
      .select()
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(departmentMasterT.department_name),
    db
      .select()
      .from(collegeT)
      .where(eq(collegeT.display, "Y"))
      .orderBy(collegeT.college_name),
  ]);

  const deptById = new Map(departments.map((d) => [d.id, d.department_name]));
  const officeById = new Map(offices.map((o) => [o.id, o.college_name]));
  const roleById = new Map(roles.map((r) => [r.id, r.role_name]));

  const rows = roles.map((r) => {
    const perms = [
      r.department ? "Department" : null,
      r.management ? "Management" : null,
      r.finance ? "Finance" : null,
    ].filter(Boolean);
    return {
      ...r,
      department_id: r.department_id ?? 0,
      office_location_id: r.office_location_id ?? 0,
      parent_role_id: r.parent_role_id ?? 0,
      approval_level: r.approval_level ?? 0,
      department_name: (r.department_id && deptById.get(r.department_id)) || "—",
      office_name: (r.office_location_id && officeById.get(r.office_location_id)) || "—",
      parent_role_name: (r.parent_role_id && roleById.get(r.parent_role_id)) || "—",
      permissions: perms.length ? perms.join(", ") : "—",
    };
  });

  const fields: FieldDef[] = [
    { name: "role_name", label: "Role Name", required: true },
    {
      name: "department_id",
      label: "Department",
      type: "select",
      default: 0,
      options: [
        { value: 0, label: "— Select Department —" },
        ...departments.map((d) => ({ value: d.id, label: d.department_name })),
      ],
    },
    {
      name: "office_location_id",
      label: "Office Location",
      type: "select",
      default: 0,
      options: [
        { value: 0, label: "— Select Office —" },
        ...offices.map((o) => ({ value: o.id, label: o.college_name })),
      ],
    },
    {
      name: "parent_role_id",
      label: "Parent Role",
      type: "select",
      default: 0,
      options: [
        { value: 0, label: "— None —" },
        ...roles.map((r) => ({ value: r.id, label: r.role_name })),
      ],
    },
    { name: "approval_level", label: "Approval Level", type: "number", default: 0 },
    { name: "department", label: "Access: Department", type: "select", default: 0, options: YES_NO },
    { name: "management", label: "Access: Management", type: "select", default: 0, options: YES_NO },
    { name: "finance", label: "Access: Finance", type: "select", default: 0, options: YES_NO },
    {
      name: "display",
      label: "Display",
      type: "select",
      default: "Y",
      options: [
        { value: "Y", label: "Yes" },
        { value: "N", label: "No" },
      ],
    },
  ];

  return (
    <CrudTable apiKey="role" title="Role" columns={columns} rows={rows} fields={fields} />
  );
}
