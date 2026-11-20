/**
 * The words on the Help page. Kept as data so it's easy to update when the app
 * changes. In text, **bold** marks the name of a button or setting as it
 * appears on screen.
 */

export type HelpBlock =
  | { kind: "text"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "tip"; text: string };

export type HelpTopic = {
  id: string;
  title: string;
  /** Only administrators can do this. */
  adminOnly?: boolean;
  body: HelpBlock[];
};

export type HelpSection = {
  id: string;
  title: string;
  description: string;
  topics: HelpTopic[];
};

const text = (value: string): HelpBlock => ({ kind: "text", text: value });
const steps = (...items: string[]): HelpBlock => ({ kind: "steps", items });
const list = (...items: string[]): HelpBlock => ({ kind: "list", items });
const tip = (value: string): HelpBlock => ({ kind: "tip", text: value });

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "How the app fits together, and who can change what.",
    topics: [
      {
        id: "how-it-works",
        title: "How it all fits together",
        body: [
          text("Each day's roster is a grid: one column per person, one row per 15 minutes. Coloured blocks show what each person is doing."),
          list(
            "**People** holds everyone you roster, and the days and hours they usually work.",
            "**Tasks** and **Tours** hold the jobs that fill the day, and the rules for when and how they happen.",
            "**Editor** is where you plan a day: press **Autofill** to build the roster from those rules, then adjust it by hand.",
            "**Rosters** lists the coming days, and lets you look back at past ones.",
            "**Settings** holds the opening hours and other defaults, plus your account."
          ),
          tip("Set up People, Tasks and Tours first. The better the rules, the less you'll need to change after pressing Autofill."),
        ],
      },
      {
        id: "roles",
        title: "Who can change what",
        body: [
          text("There are two kinds of account."),
          list(
            "**Editors** can plan and change rosters.",
            "**Administrators** can also add and change people, tasks and tours, change the settings, manage users and use backups."
          ),
          text("If a page won't save your changes, ask an administrator to make them, or to make you an administrator."),
        ],
      },
      {
        id: "signing-in",
        title: "Signing in and two-factor",
        body: [
          text("Everyone signs in with their email, their password and a 6-digit code from an authenticator app (such as Google Authenticator or Microsoft Authenticator). You set the app up the first time you sign in."),
          list(
            "When you turn two-factor on, you're given **recovery codes**. Keep them somewhere safe: each one works once instead of the 6-digit code if you lose your phone.",
            "Forgotten your password? Use **Forgot password?** on the sign-in page, or ask an administrator to send you a reset link.",
            "New phone, or lost your authenticator? Ask an administrator to turn off two-factor for you. You'll set it up again the next time you sign in.",
            "No account yet? Choose **Request access** on the sign-in page. An administrator approves it."
          ),
        ],
      },
    ],
  },
  {
    id: "editor",
    title: "Planning a day",
    description: "Using the editor to build and adjust a day's roster.",
    topics: [
      {
        id: "open-a-day",
        title: "Open a day",
        body: [
          list(
            "On the **Rosters** page, click a day.",
            "Or click **Editor** in the menu, which opens the last day you worked on.",
            "In the editor, use **‹** and **›** to step a day back or forward, **Today** to jump to today, or the date box to pick any day."
          ),
        ],
      },
      {
        id: "autofill",
        title: "Build the roster with Autofill",
        body: [
          steps(
            "Check the right people are on the day (see “Choose who's working”).",
            "If there are school tours, import them first (see “Import school tours”).",
            "Press **Autofill**."
          ),
          text("Autofill places every task and tour from their rules: set-time tours and briefings first, then must-be-manned cover, then spare time on floor tasks. It shares tours out evenly and keeps each person's tours apart where it can."),
          list(
            "Autofill **replaces every block that isn't locked**. Lock any block you want to keep first (see “Lock a block”).",
            "Press **Autofill** again for a different, equally good version.",
            "If it can't place something, a yellow notice says what and why.",
            "Don't like the result? **Undo** brings back what you had."
          ),
        ],
      },
      {
        id: "who-is-working",
        title: "Choose who's working",
        body: [
          text("A new day starts with everyone whose working pattern includes that day."),
          list(
            "To add or take people off, press **Add person** and tick or untick them in **People on this day**.",
            "To change one person's hours for this day only, click their name at the top of their column, set the start and finish, and apply. **Use usual hours** goes back to their normal hours.",
            "To take someone off this day, click their name and choose **Remove**."
          ),
          tip("Changes here only affect this day. To change someone's usual days or hours, edit them on the People page."),
        ],
      },
      {
        id: "day-hours",
        title: "Change the opening hours for a day",
        body: [
          text("Use the **Hours** boxes in the toolbar to change the start and end of this day only. The usual hours for each weekday are in Settings."),
        ],
      },
      {
        id: "add-block",
        title: "Add a block by hand",
        body: [
          steps(
            "Hover over an empty slot in someone's column: a **+** appears.",
            "Click it and choose a task. Type to filter the list; Enter picks the first match."
          ),
          text("Tours and tasks with a fixed time go in at their full length. Other tasks start as 15 minutes: drag the bottom edge to make them longer."),
        ],
      },
      {
        id: "edit-blocks",
        title: "Move, resize or delete a block",
        body: [
          list(
            "**Move:** drag the block, up and down or to another person's column. Whatever it lands on is replaced or trimmed to make room.",
            "**Resize:** click the block to select it, then drag the blue handle at its top or bottom.",
            "**Delete:** click the block, then press Delete or Backspace.",
            "**Undo / Redo:** use the arrow buttons next to Autofill."
          ),
        ],
      },
      {
        id: "lock",
        title: "Lock a block",
        body: [
          text("**Double-click** a block to lock it. A padlock appears in its corner."),
          list(
            "Autofill leaves locked blocks exactly where they are and fits everything else around them.",
            "A locked block can't be moved, resized or deleted, and nothing can be dropped on top of it.",
            "Double-click it again to unlock it."
          ),
          tip("Lock the parts of the day that are already agreed, such as a planned meeting, before pressing Autofill."),
        ],
      },
      {
        id: "zoom-reset",
        title: "Zoom, and start the day again",
        body: [
          list(
            "Use the magnifying glass buttons to zoom the grid in or out.",
            "**Reset** clears every block and brings back the day's usual staff. Imported school tours are kept, and you can undo it."
          ),
        ],
      },
      {
        id: "saving",
        title: "Saving",
        body: [
          text("Changes save automatically a moment after you make them. The line under the date shows when the day was last saved. Press **Save** to save straight away."),
          text("If it says **Couldn't save**, check your internet connection and press **Save** again."),
        ],
      },
      {
        id: "export",
        title: "Print or share a roster",
        body: [
          text("Press **Export** to download the day as an Excel file, laid out like the printed roster. Open it to print it or send it on."),
        ],
      },
    ],
  },
  {
    id: "school-tours",
    title: "School tours",
    description: "Bringing in the day's school bookings.",
    topics: [
      {
        id: "import-school-tours",
        title: "Import school tours",
        body: [
          steps(
            "Open the day in the editor.",
            "Click **School tours** in the toolbar and choose the runsheet, or drag the file straight onto that button.",
            "Press **Autofill**. Each school tour is placed at its booked time."
          ),
          list(
            "The file must be an Excel file (.xlsx) with **Date**, **Time**, **School** and **Students** columns.",
            "Only bookings for the day you're on are added. Others in the file are left out.",
            "The imported tours are listed below the grid. Use the × next to one to remove it."
          ),
        ],
      },
      {
        id: "school-tour-setup",
        title: "Choose which tour school bookings use",
        adminOnly: true,
        body: [
          text("Imported bookings are placed as the tour marked **Use for imported school tours**, so they get its length, colour and rules. Only one tour can have this turned on."),
          steps("Go to **Tours** and open the tour.", "Under **Rules**, turn on **Use for imported school tours**."),
        ],
      },
    ],
  },
  {
    id: "rosters",
    title: "Finding rosters",
    description: "The coming days, and looking back.",
    topics: [
      {
        id: "upcoming",
        title: "See the coming days",
        body: [
          text("The **Rosters** page lists the coming days. Click one to open it. An administrator can change how many days are shown in Settings."),
        ],
      },
      {
        id: "past-rosters",
        title: "Look back at past rosters",
        body: [
          steps(
            "On the **Rosters** page, press **Past rosters**.",
            "Use **‹** and **›** to step through the months, **This month** to come back, or the month box to jump straight to a month.",
            "Click a day to open it."
          ),
          text("Each month lists every day that was saved, newest first."),
        ],
      },
    ],
  },
  {
    id: "people",
    title: "People",
    description: "Who you roster, and when they usually work.",
    topics: [
      {
        id: "add-person",
        title: "Add someone",
        adminOnly: true,
        body: [
          steps(
            "Go to **People** and press **Add person**.",
            "Enter their name and add them.",
            "Open them from the list to set their working pattern."
          ),
        ],
      },
      {
        id: "working-pattern",
        title: "Set someone's days and hours",
        adminOnly: true,
        body: [
          text("Each person has a two-week pattern: **Week A** and **Week B**, which alternate. The page says which week this week is."),
          list(
            "Tick the days they work and set their start and finish times.",
            "For someone who works the same every week, set up Week A, then press **A to B** to copy it.",
            "**Week A starts** sets which week counts as Week A."
          ),
          text("In the People list, the day letters show each person's pattern: filled in for every week, half filled for alternate weeks, grey for days off."),
          tip("This is their usual pattern. To change one day only, use their name at the top of their column in the editor."),
        ],
      },
      {
        id: "remove-person",
        title: "Remove someone",
        adminOnly: true,
        body: [
          text("Open them and press **Delete**. They're also taken off every task's and tour's “Who can do this” list. Rosters already saved aren't changed."),
        ],
      },
    ],
  },
  {
    id: "tasks",
    title: "Tasks and tours",
    description: "Setting up the jobs that fill the day, and how Autofill places them.",
    topics: [
      {
        id: "add-task",
        title: "Add a task or tour",
        adminOnly: true,
        body: [
          steps(
            "Go to **Tasks** and press **Add task**, or **Tours** and **Add tour**.",
            "Give it a name, then open it to set its colour, rules and times."
          ),
          text("Tasks and tours work the same way. Tours are listed separately, always start with a 15-minute waiting block, and are shared out evenly between people. Switch between the two with **Type** on its page."),
        ],
      },
      {
        id: "when-it-happens",
        title: "Set when it happens",
        adminOnly: true,
        body: [
          text("Under **When it happens**, tick the days it runs. Then either:"),
          list(
            "add **set start times**, for things that start at a fixed time, such as an 11:00 tour; or",
            "add **time ranges**, for things that can happen any time within them. With two ranges, say 10:00–12:00 and 14:00–16:00, it never runs in the gap between."
          ),
          text("With neither, it can happen any time the place is open."),
        ],
      },
      {
        id: "rules",
        title: "What the rules mean",
        adminOnly: true,
        body: [
          text("Rules are under **Rules** on a task's page. They only affect Autofill: you can always place any task by hand."),
          list(
            "**Use in autofill:** turn off to stop Autofill using it at all.",
            "**Must be manned:** someone is always on it while it runs, such as a front desk.",
            "**Everyone attends:** everyone working at that time does it together, such as a briefing.",
            "**Takes priority:** placed over other tasks in its way, rather than only in free time.",
            "**Fixed time:** each block lasts a set length, instead of filling the gap it's in.",
            "**Waiting for beforehand / Packing up:** adds a short block before or after it.",
            "**Waiting time can be covered:** if nobody is free for the waiting time, the person on a briefing or a must-be-manned task stays on that, and this still starts on time.",
            "**Limit time in one go / Ideal time in one go:** the longest one person spends on it before moving to something else.",
            "**How often:** limits per person each day, in total each day, and how many people can be on it at once. Leave blank for no limit."
          ),
        ],
      },
      {
        id: "floor-tasks",
        title: "Floor tasks and spare time",
        adminOnly: true,
        body: [
          text("A task with no set times that isn't a tour or tied to another task is a **floor task**. Autofill uses floor tasks to fill people's spare time, and the task's page says so at the top of Rules."),
          list(
            "Floor tasks with a **Most people on it at once** limit are filled first, up to that number.",
            "Floor tasks without a limit take whatever spare time is left.",
            "People move on to another floor task after its **Ideal time in one go**."
          ),
        ],
      },
      {
        id: "who-can-do-it",
        title: "Choose who can do a task or tour",
        adminOnly: true,
        body: [
          text("Not everyone can give every tour. Under **Who can do this**, add the people who can. Autofill only gives it to them."),
          list("Leave the list empty if anyone can do it.", "You can still put anyone on it by hand in the editor."),
        ],
      },
      {
        id: "paired-tasks",
        title: "Make a task go with another one",
        adminOnly: true,
        body: [
          text("Use this for things that should happen straight before or after something else, such as Emails after a break."),
          steps(
            "Open the task and turn on **Goes with another task**.",
            "Choose **Straight after** or **Straight before**, and the task it goes with.",
            "To give it a choice, press **Or another task** and add another, such as Morning Break or Afternoon Break."
          ),
          list(
            "With one task chosen, it goes beside every block of that task.",
            "With more than one, each person gets it once a day. Autofill keeps room beside the first one in the list that runs that day, moving it within its own time range if it needs to. Tasks that don't run that day, such as a weekday-only break on a Sunday, are skipped.",
            "Room is never kept at the cost of someone's break or a gap in must-be-manned cover. If it would be, it goes beside the next one with room, or is left out that day."
          ),
        ],
      },
      {
        id: "task-changes",
        title: "When changes take effect",
        body: [
          text("Changes to people, tasks and tours don't change rosters that are already made. Open the day and press **Autofill** again to use the new rules. Lock anything you want to keep first."),
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    description: "Defaults, users, backups and your own account.",
    topics: [
      {
        id: "roster-defaults",
        title: "Opening hours and roster defaults",
        adminOnly: true,
        body: [
          text("Under **Settings → Roster defaults**:"),
          list(
            "**Opening hours** for each weekday, used for any day that hasn't been changed in the editor.",
            "**Days shown on the Rosters page**.",
            "**Minimum gap between one person's tours:** Autofill keeps each person's tours at least this many minutes apart when someone else is free to take one. Set 0 to turn it off."
          ),
          text("Changes save automatically, or press **Save**."),
        ],
      },
      {
        id: "users",
        title: "Add and manage users",
        adminOnly: true,
        body: [
          text("Under **Settings → Users**, press **Add user**. Send them an invitation email, or create a link to send yourself. They set their own password with it."),
          text("Next to each user you can:"),
          list(
            "make them an **Administrator** or an **Editor**;",
            "send a **password reset** link;",
            "**turn off two-factor**, if they've lost their authenticator;",
            "**sign them out everywhere**;",
            "**deactivate** them, which stops them signing in until you reactivate them."
          ),
          text("People who asked for access from the sign-in page are listed under **Account requests**. Approve them there."),
          tip("You never see anyone's password. **Account activity** keeps a record of the last 50 account changes."),
        ],
      },
      {
        id: "backups",
        title: "Backups and restoring",
        adminOnly: true,
        body: [
          text("A copy of all people, tasks, tours, settings and rosters is taken automatically once a day, and the last 14 are kept. User accounts aren't included. They're under **Settings → Backups**."),
          list(
            "**Back up now** takes one straight away, for example before a big change.",
            "**Download** saves a backup to your computer.",
            "**Restore** replaces everything with that backup. A backup of the current data is taken first, so a restore can be undone by restoring that one.",
            "**Restore from file** restores a backup you downloaded earlier."
          ),
        ],
      },
      {
        id: "your-account",
        title: "Your email, password and two-factor",
        body: [
          text("Under **Settings**, anyone can change their own sign-in email and password, and manage their two-factor. Changing your password signs you out on your other devices."),
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Something's not right",
    description: "Common problems and what to check.",
    topics: [
      {
        id: "autofill-couldnt-place",
        title: "“Autofill couldn't place everything”",
        body: [
          text("The notice lists what's missing. Usually one of these is why:"),
          list(
            "Not enough people are working at that time. Add someone, or change someone's hours for the day.",
            "Nobody free is on its **Who can do this** list.",
            "Locked blocks are in the way. Unlock what doesn't need to stay.",
            "Its rules are too tight, such as a low **At most** limit or a short time range."
          ),
        ],
      },
      {
        id: "someone-missing",
        title: "Someone is missing from a day",
        body: [
          list(
            "Check their working pattern on the People page, including which week (A or B) this is.",
            "The day may have been saved before they were added. Use **Add person** in the editor to put them on."
          ),
        ],
      },
      {
        id: "tour-wrong-person",
        title: "A tour went to the wrong person",
        body: [
          text("Check the tour's **Who can do this** list. Then fix that day by dragging the tour to the right person, or lock the tours you want and press **Autofill** again."),
        ],
      },
      {
        id: "tours-too-close",
        title: "One person's tours are too close together",
        body: [
          text("Autofill keeps tours apart only when someone else is free and able to take one, and never gives someone an extra tour just to keep a gap. On a busy day it keeps them as far apart as it can. An administrator can change the gap in **Settings → Roster defaults**."),
        ],
      },
    ],
  },
];
