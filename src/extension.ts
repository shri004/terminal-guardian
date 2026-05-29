import * as vscode from 'vscode';

// Each entry describes one dangerous command
interface DangerousCommand {
  pattern: RegExp;
  name: string;
  what: string;
  recovery: string;
  safer: string;
}

// The command list — this is the heart of the extension
const DANGEROUS_COMMANDS: DangerousCommand[] = [
  {
    pattern: /git\s+clean\s+-\S*f/i,
    name: 'git clean -f',
    what: 'Permanently deletes all untracked files. These were never in git history — they are gone forever.',
    recovery: 'Run "git reflog" to check recent history. Untracked files cannot be recovered through git.',
    safer: 'Run "git clean -n" first — it previews what would be deleted without deleting anything.'
  },
  {
    pattern: /git\s+reset\s+--hard/i,
    name: 'git reset --hard',
    what: 'Throws away all uncommitted changes to tracked files. Any edits not yet committed are gone.',
    recovery: 'Run "git reflog" to find the commit before the reset, then "git reset --hard <that-hash>".',
    safer: 'Run "git stash" first to save your changes safely, then reset.'
  },
  {
    pattern: /git\s+checkout\s+\./i,
    name: 'git checkout .',
    what: 'Discards all uncommitted changes to tracked files, reverting them to the last commit.',
    recovery: 'Uncommitted changes cannot be recovered through git. Check your editor local history.',
    safer: 'Use "git stash" to save changes safely before checking out.'
  },
  {
    pattern: /git\s+push\s+.*--force(?!-with-lease)/i,
    name: 'git push --force',
    what: 'Overwrites the remote branch with your local version. Teammates on the same branch will have conflicts.',
    recovery: 'Ask teammates if they have local copies. Check if the remote has reflog enabled.',
    safer: 'Use "git push --force-with-lease" — only pushes if nobody else pushed since your last pull.'
  },
  {
    pattern: /rm\s+-rf/i,
    name: 'rm -rf',
    what: 'Permanently deletes files and folders with no confirmation. Does not go to Recycle Bin or Trash.',
    recovery: 'Files deleted with rm -rf are not recoverable on SSDs.',
    safer: 'Double-check the exact path before running. Consider moving to trash manually first.'
  },
  {
    pattern: /docker\s+system\s+prune/i,
    name: 'docker system prune',
    what: 'Removes all stopped containers, unused networks, dangling images, and build cache.',
    recovery: 'Images can be re-pulled from registry. Local container data is gone.',
    safer: 'Use "docker system prune --filter until=24h" to only remove things older than 24 hours.'
  },
  {
    pattern: /DROP\s+(DATABASE|TABLE|SCHEMA)/i,
    name: 'DROP DATABASE / TABLE / SCHEMA',
    what: 'Permanently deletes the database, table, or schema and every row of data inside it.',
    recovery: 'Only recoverable from a backup. No backup means the data is gone permanently.',
    safer: 'Always take a backup before DROP commands. Use a transaction if your database supports rollback.'
  }
];

// This runs when VS Code activates your extension
export function activate(context: vscode.ExtensionContext) {

  const listener = vscode.window.onDidStartTerminalShellExecution(event => {
    const command = event.execution.commandLine.value.trim();

    for (const dangerous of DANGEROUS_COMMANDS) {
      if (dangerous.pattern.test(command)) {
        showWarning(dangerous);
        break;
      }
    }
  });

  context.subscriptions.push(listener);
}

// Shows a warning notification with two action buttons
function showWarning(cmd: DangerousCommand) {
  vscode.window.showWarningMessage(
    `⚠️ ${cmd.name}: ${cmd.what}`,
    'How to recover',
    'Safer alternative'
  ).then(selection => {
    if (selection === 'How to recover') {
      vscode.window.showInformationMessage(`🔁 Recovery: ${cmd.recovery}`);
    } else if (selection === 'Safer alternative') {
      vscode.window.showInformationMessage(`✅ Safer: ${cmd.safer}`);
    }
  });
}

export function deactivate() {}