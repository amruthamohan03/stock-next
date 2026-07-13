import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { usersT, roleMasterT, departmentMasterT, collegeT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

// Ports UserController (masters/user) — CRUD for users_t.
// Password is bcrypt-hashed by the generic masters route (config: hash:["password"]).
const columns: ColumnDef[] = [
  { key: "username", label: "Username" },
  { key: "full_name", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "role_name", label: "Role" },
  { key: "dept_name", label: "Department" },
  { key: "location_name", label: "Location" },
  { key: "display", label: "Status", badge: true },
];

export default async function UserPage() {
  const [users, roles, departments, locations] = await Promise.all([
    // Note: password is intentionally NOT selected — the hash must not reach the client.
    db
      .select({
        id: usersT.id,
        username: usersT.username,
        email: usersT.email,
        full_name: usersT.full_name,
        role_id: usersT.role_id,
        dept_id: usersT.dept_id,
        location_id: usersT.location_id,
        display: usersT.display,
      })
      .from(usersT)
      .where(eq(usersT.display, "Y"))
      .orderBy(desc(usersT.id)),
    db
      .select()
      .from(roleMasterT)
      .where(eq(roleMasterT.display, "Y"))
      .orderBy(roleMasterT.role_name),
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

  const roleById = new Map(roles.map((r) => [r.id, r.role_name]));
  const deptById = new Map(departments.map((d) => [d.id, d.department_name]));
  const locById = new Map(locations.map((l) => [l.id, l.college_name]));

  // dept_id / location_id are varchar in the schema — coerce for the numeric lookup.
  const num = (v: string | null) => (v == null || v === "" ? null : Number(v));

  const rows = users.map((u) => ({
    ...u,
    role_name: roleById.get(u.role_id) ?? "—",
    dept_name: deptById.get(num(u.dept_id) as number) ?? "—",
    location_name: locById.get(num(u.location_id) as number) ?? "—",
  }));

  const fields: FieldDef[] = [
    { name: "username", label: "Username", required: true },
    {
      name: "password",
      label: "Password",
      type: "password",
      placeholder: "Set on create · leave blank to keep on edit",
    },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "full_name", label: "Full Name", required: true },
    {
      name: "role_id",
      label: "Role",
      type: "select",
      options: roles.map((r) => ({ value: r.id, label: r.role_name })),
    },
    {
      name: "dept_id",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ value: d.id, label: d.department_name })),
    },
    {
      name: "location_id",
      label: "Location",
      type: "select",
      options: locations.map((l) => ({ value: l.id, label: l.college_name })),
    },
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
    <CrudTable apiKey="user" title="User" columns={columns} rows={rows} fields={fields} />
  );
}
