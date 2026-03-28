import fs from "fs";
import path from "path";

export type AccountEditor = {
  id: string;
  name: string;
  isAdmin?: boolean;
};

export type Account = {
  id: string;
  name: string;
  company: string;
  editors: AccountEditor[];
};

const DATA_FILE = path.join(process.cwd(), "data", "accounts.json");

const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "mint",
    name: "Mint",
    company: "Roster Generator",
    editors: [
      { id: "admin", name: "Mint Admin", isAdmin: true },
      { id: "editor-1", name: "Mint Editor 1" },
      { id: "editor-2", name: "Mint Editor 2" },
    ],
  },
];

function normalizeAccounts(input: unknown): Account[] {
  const list = Array.isArray((input as any)?.accounts) ? (input as any).accounts : input;
  const baseList = Array.isArray(list) && list.length ? list : DEFAULT_ACCOUNTS;
  return baseList.map((acct: any) => ({
    id: String(acct.id),
    name: String(acct.name),
    company: String(acct.company || "Roster Generator"),
    editors: Array.isArray(acct.editors)
      ? acct.editors.map((editor: any) => ({
          id: String(editor.id),
          name: String(editor.name),
          isAdmin:
            typeof editor.isAdmin === "boolean" ? editor.isAdmin : editor.role === "admin",
        }))
      : [],
  }));
}

export function getAccounts(): Account[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return DEFAULT_ACCOUNTS;
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return normalizeAccounts(JSON.parse(raw));
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

export function getAccountById(accountId: string): Account | null {
  return getAccounts().find((acct) => acct.id === accountId) ?? null;
}

export function getEditor(accountId: string, editorId: string): AccountEditor | null {
  const account = getAccountById(accountId);
  if (!account) return null;
  return account.editors.find((editor) => editor.id === editorId) ?? null;
}
