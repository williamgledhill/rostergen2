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

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "accounts.json");

const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "mint",
    name: "Mint",
    company: "roster.app",
    editors: [
      { id: "admin", name: "Mint Admin", isAdmin: true },
      { id: "editor-1", name: "Mint Editor 1" },
      { id: "editor-2", name: "Mint Editor 2" },
    ],
  },
];

function ensureAccountsFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ accounts: DEFAULT_ACCOUNTS }, null, 2), "utf-8");
  }
}

export function getAccounts(): Account[] {
  try {
    ensureAccountsFile();
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { accounts?: Account[] };
    const baseList = Array.isArray(parsed?.accounts) && parsed.accounts.length ? parsed.accounts : DEFAULT_ACCOUNTS;
    const normalized = baseList.map((acct) => ({
      ...acct,
      editors: (acct.editors || []).map((editor: any) => ({
        id: editor.id,
        name: editor.name,
        isAdmin: typeof editor.isAdmin === "boolean" ? editor.isAdmin : editor.role === "admin",
      })),
    }));
    fs.writeFileSync(DATA_FILE, JSON.stringify({ accounts: normalized }, null, 2), "utf-8");
    return normalized;
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
